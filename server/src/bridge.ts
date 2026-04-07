import { FastifyRequest, FastifyReply } from "fastify";
import { v4 as uuid } from "uuid";
import { ServerResponse } from "http";
import * as store from "./store";

const KEEPALIVE_INTERVAL_MS = 30_000;

const clients = new Map<string, ServerResponse>();
let keepaliveInterval: NodeJS.Timeout | null = null;

function removeStaleClient(clientId: string): void {
  try {
    clients.delete(clientId);
  } catch (error) {
    console.error("Failed to remove stale client:", error);
  }
}

export function handleNewClient(
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const raw = reply.raw;

  const historyData = JSON.stringify({ events: store.getEventLog() });
  raw.write(`event: history\ndata: ${historyData}\n\n`);

  const approvalsData = JSON.stringify({
    approvals: store.getPendingApprovals(),
  });
  raw.write(`event: approvals\ndata: ${approvalsData}\n\n`);

  const clientId = uuid();
  const connectedData = JSON.stringify({ clientId, timestamp: Date.now() });
  raw.write(`event: connected\ndata: ${connectedData}\n\n`);

  clients.set(clientId, raw);

  raw.on("close", () => {
    clients.delete(clientId);
  });
}

export function broadcast(event: object): void {
  const data = JSON.stringify(event);
  const message = `event: opencode\ndata: ${data}\n\n`;

  // Collect stale clients first, then remove to avoid modifying Map during iteration
  const staleClients: string[] = [];
  for (const [clientId, raw] of clients.entries()) {
    try {
      raw.write(message);
    } catch (error) {
      console.error("Failed to broadcast to client:", error);
      staleClients.push(clientId);
    }
  }
  staleClients.forEach(removeStaleClient);
}

export function getConnectedClientCount(): number {
  return clients.size;
}

// Start keepalive interval and export cleanup function
export function startKeepalive(): void {
  if (keepaliveInterval) return;
  
  keepaliveInterval = setInterval(() => {
    // Collect stale clients first, then remove to avoid modifying Map during iteration
    const staleClients: string[] = [];
    for (const [clientId, raw] of clients.entries()) {
      try {
        raw.write(": keepalive\n\n");
      } catch (error) {
        console.error("Failed to send keepalive to client:", error);
        staleClients.push(clientId);
      }
    }
    staleClients.forEach(removeStaleClient);
  }, KEEPALIVE_INTERVAL_MS);
}

export function stopKeepalive(): void {
  if (keepaliveInterval) {
    clearInterval(keepaliveInterval);
    keepaliveInterval = null;
  }
}

// Auto-start keepalive when module loads
startKeepalive();
