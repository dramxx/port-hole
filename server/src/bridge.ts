import { FastifyRequest, FastifyReply } from "fastify";
import { v4 as uuid } from "uuid";
import { ServerResponse } from "http";
import * as store from "./store";

const clients = new Map<string, ServerResponse>();

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

  for (const [clientId, raw] of clients.entries()) {
    try {
      raw.write(message);
    } catch {
      clients.delete(clientId);
    }
  }
}

export function getConnectedClientCount(): number {
  return clients.size;
}

setInterval(() => {
  for (const [clientId, raw] of clients.entries()) {
    try {
      raw.write(": keepalive\n\n");
    } catch {
      clients.delete(clientId);
    }
  }
}, 30000);
