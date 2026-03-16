import { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";
import * as opencode from "./opencode";
import * as store from "./store";
import * as bridge from "./bridge";
import * as process from "./process";

const PWA_DIR = path.join(__dirname, "..", "..", "pwa-react", "dist");

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // SSE stream must be registered BEFORE static files
  app.get("/stream", { logLevel: "warn" }, (req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    bridge.handleNewClient(req, reply);
  });

  // Status endpoint
  app.get("/api/status", async (req, reply) => {
    return {
      opencodeStatus: process.getStatus(),
      connectedClients: bridge.getConnectedClientCount(),
    };
  });

  // Sessions endpoints
  app.get("/api/sessions", async (req, reply) => {
    try {
      const sessions = await opencode.getSessions();
      return sessions;
    } catch (error: any) {
      if (error instanceof opencode.OpenCodeError) {
        return reply.status(error.status).send({ error: error.message });
      }
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  app.get<{ Params: { id: string } }>(
    "/api/sessions/:id/messages",
    async (req, reply) => {
      try {
        const messages = await opencode.getMessages(req.params.id);
        return messages;
      } catch (error: any) {
        if (error instanceof opencode.OpenCodeError) {
          return reply.status(error.status).send({ error: error.message });
        }
        return reply.status(500).send({ error: "Internal server error" });
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { text?: string } }>(
    "/api/sessions/:id/prompt",
    async (req, reply) => {
      try {
        console.log("Bridge received prompt request:", req.params.id, req.body);
        const { text } = req.body;

        if (!text || typeof text !== "string" || text.trim() === "") {
          console.log("Bridge rejecting empty prompt");
          return reply
            .status(400)
            .send({ error: "text is required and must be a non-empty string" });
        }

        console.log("Bridge calling opencode.sendPrompt");
        await opencode.sendPrompt(req.params.id, text);
        console.log("Bridge opencode.sendPrompt completed");
        return reply.status(204).send();
      } catch (error: any) {
        console.log("Bridge prompt error:", error);
        if (error instanceof opencode.OpenCodeError) {
          return reply.status(error.status).send({ error: error.message });
        }
        return reply.status(500).send({ error: "Internal server error" });
      }
    },
  );

  app.post<{
    Params: { id: string; permissionId: string };
    Body: { allow?: boolean };
  }>("/api/sessions/:id/approve/:permissionId", async (req, reply) => {
    try {
      const { allow } = req.body;

      if (typeof allow !== "boolean") {
        return reply
          .status(400)
          .send({ error: "allow is required and must be a boolean" });
      }

      await opencode.approvePermission(
        req.params.id,
        req.params.permissionId,
        allow,
      );
      store.resolveApproval(req.params.permissionId, allow ? "allow" : "deny");
      bridge.broadcast({
        type: "permission.replied",
        properties: {
          sessionID: req.params.id,
          requestID: req.params.permissionId,
          reply: allow ? "once" : "reject",
        },
      });
      return reply.status(204).send();
    } catch (error: any) {
      if (error instanceof opencode.OpenCodeError) {
        return reply.status(error.status).send({ error: error.message });
      }
      if (error.message === "Unknown permissionId") {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  app.post<{ Params: { id: string } }>(
    "/api/sessions/:id/abort",
    async (req, reply) => {
      try {
        await opencode.abortSession(req.params.id);
        return reply.status(204).send();
      } catch (error: any) {
        if (error instanceof opencode.OpenCodeError) {
          return reply.status(error.status).send({ error: error.message });
        }
        return reply.status(500).send({ error: "Internal server error" });
      }
    },
  );

  // Register static file plugin AFTER all API routes
  await app.register(fastifyStatic, {
    root: PWA_DIR,
    prefix: "/",
  });

  // SPA fallback for client-side routing
  app.setNotFoundHandler(async (req, reply) => {
    if (
      req.url.startsWith("/api/") ||
      req.url === "/stream" ||
      path.extname(req.url)
    ) {
      return reply.status(404).send({ error: "Not Found" });
    }
    return reply.sendFile("index.html");
  });
}
