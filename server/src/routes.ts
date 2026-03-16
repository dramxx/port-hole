import { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";
import * as opencode from "./opencode";
import * as store from "./store";
import * as bridge from "./bridge";
import * as process from "./process";

const PWA_DIR = path.join(__dirname, "..", "..", "pwa-react", "dist");

interface ClientMessagePart {
  type: "text" | "reasoning" | "tool";
  text?: string;
  name?: string;
  status?: string;
  input?: unknown;
  output?: string;
}

interface ClientMessage {
  id: string;
  role: string;
  timestamp: number;
  parts: ClientMessagePart[];
}

function hasDisplayText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function stringifyValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    return value.trim() === "" ? undefined : value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizePart(
  part: opencode.OpenCodeMessagePart,
): ClientMessagePart[] {
  const type = part.type ?? "";

  if (type === "text" && hasDisplayText(part.text)) {
    return [{ type: "text", text: part.text }];
  }

  if (type === "reasoning" && hasDisplayText(part.text)) {
    return [{ type: "reasoning", text: part.text }];
  }

  if (
    type === "tool" ||
    type === "tool_use" ||
    type === "tool_result" ||
    type === "tool_code" ||
    type === "patch"
  ) {
    const name =
      (typeof part.name === "string" && part.name) ||
      (typeof part.tool === "string" && part.tool) ||
      (typeof part.callID === "string" && part.callID) ||
      type;
    const input = part.input ?? part.state?.input;
    const output =
      stringifyValue(part.output) ??
      stringifyValue(part.content) ??
      stringifyValue(part.state?.output) ??
      stringifyValue(part.state?.result) ??
      (hasDisplayText(part.text) ? part.text : undefined);

    if (input === undefined && output === undefined) {
      return [];
    }

    return [
      {
        type: "tool",
        name,
        status:
          typeof part.state?.status === "string"
            ? part.state.status
            : undefined,
        input,
        output,
      },
    ];
  }

  if (hasDisplayText(part.text)) {
    return [{ type: "text", text: part.text }];
  }

  const output = stringifyValue(part.content);
  if (!output) {
    return [];
  }

  return [
    {
      type: "tool",
      name: type || "part",
      output,
    },
  ];
}

function normalizeMessages(
  messages: opencode.OpenCodeMessage[],
): ClientMessage[] {
  return messages
    .map((message, index) => {
      const parts = Array.isArray(message.parts)
        ? message.parts.flatMap(normalizePart)
        : [];
      const role =
        message.info?.role ??
        message.role ??
        (parts.length > 0 ? "assistant" : "unknown");
      const timestamp =
        message.info?.time?.created ??
        message.info?.time?.updated ??
        message.timestamp ??
        Date.now();
      const id =
        message.info?.id ?? message.id ?? `${role}-${timestamp}-${index}`;

      return {
        id,
        role,
        timestamp,
        parts,
      };
    })
    .filter((message) => message.parts.length > 0);
}

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
        return normalizeMessages(messages);
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
        const { text } = req.body;

        if (!text || typeof text !== "string" || text.trim() === "") {
          return reply
            .status(400)
            .send({ error: "text is required and must be a non-empty string" });
        }

        await opencode.sendPrompt(req.params.id, text);
        return reply.status(204).send();
      } catch (error: any) {
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
