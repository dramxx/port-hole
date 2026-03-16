import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

import Fastify from "fastify";
import os from "os";
import * as processManager from "./process";
import * as opencode from "./opencode";
import * as store from "./store";
import * as bridge from "./bridge";
import { registerRoutes } from "./routes";

function getPermissionId(event: any): string | undefined {
  const properties = event?.properties ?? {};
  return (
    properties.permissionId ??
    properties.permissionID ??
    properties.requestId ??
    properties.requestID ??
    properties.id ??
    properties.permission?.id
  );
}

function getSessionId(event: any): string | undefined {
  const properties = event?.properties ?? {};
  return (
    properties.sessionId ??
    properties.sessionID ??
    properties.info?.sessionId ??
    properties.info?.sessionID ??
    properties.part?.sessionId ??
    properties.part?.sessionID
  );
}

function getApprovalDescription(event: any): string {
  const properties = event?.properties ?? {};

  if (
    typeof properties.description === "string" &&
    properties.description.trim() !== ""
  ) {
    return properties.description;
  }

  const permission =
    typeof properties.permission === "string" ? properties.permission : "";
  const patterns = Array.isArray(properties.patterns)
    ? properties.patterns.filter((value: unknown) => typeof value === "string")
    : [];

  if (permission && patterns.length > 0) {
    return `${permission}: ${patterns.join(", ")}`;
  }

  if (permission) {
    return `Permission required: ${permission}`;
  }

  if (patterns.length > 0) {
    return `Permission request: ${patterns.join(", ")}`;
  }

  return "Permission request";
}

function getPermissionResolution(event: any): "allow" | "deny" | undefined {
  const reply = event?.properties?.reply;

  if (reply === "reject" || reply === "deny") {
    return "deny";
  }

  if (reply === "once" || reply === "always" || reply === "allow") {
    return "allow";
  }

  return undefined;
}

function getTailscaleIP(): string | null {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface ?? []) {
      if (addr.family === "IPv4" && addr.address.startsWith("100.")) {
        const parts = addr.address.split(".").map(Number);
        if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) {
          return addr.address;
        }
      }
    }
  }
  return null;
}

async function main() {
  // Wait for OpenCode to be ready
  await new Promise<void>((resolve, reject) => {
    processManager.processEvents.on("ready", () => resolve());
    processManager.processEvents.on("fatal", (message: string) => {
      console.error(message);
      process.exit(1);
    });
    processManager.initialize();
  });

  // Create Fastify instance
  const app = Fastify({ logger: false });

  // Register routes
  await registerRoutes(app);

  // Wire event subscription
  opencode.subscribeToEvents((event: any) => {
    store.appendEvent(event);
    bridge.broadcast(event);
    if (event.type === "permission.asked") {
      const permissionId = getPermissionId(event);
      const sessionId = getSessionId(event);

      if (!permissionId || !sessionId) {
        console.warn("Skipping malformed permission.asked event", event);
        return;
      }

      store.addPendingApproval({
        permissionId,
        sessionId,
        description: getApprovalDescription(event),
      });
      return;
    }

    if (event.type === "permission.replied") {
      const permissionId = getPermissionId(event);
      const resolution = getPermissionResolution(event);

      if (!permissionId || !resolution) {
        return;
      }

      try {
        store.resolveApproval(permissionId, resolution);
      } catch {}
    }
  });

  // Start server
  const port = parseInt(process.env.BRIDGE_PORT || "3000", 10);
  await app.listen({ port, host: "0.0.0.0" });

  // Log URLs
  const tailscaleIP = getTailscaleIP();
  console.log("Bridge server running");
  console.log(`Local:     http://localhost:${port}`);
  if (tailscaleIP) {
    console.log(`Tailscale: http://${tailscaleIP}:${port}`);
  } else {
    console.log("Tailscale: not detected");
  }

  // Graceful shutdown
  process.on("SIGINT", async () => {
    await app.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Failed to start bridge server:", error);
  process.exit(1);
});
