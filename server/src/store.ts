import { v4 as uuid } from "uuid";

export interface EventLogEntry {
  id: string;
  timestamp: number;
  raw: object;
}

export interface ApprovalEntry {
  permissionId: string;
  sessionId: string;
  description: string;
  timestamp: number;
  status: "pending" | "resolved";
  resolution?: "allow" | "deny";
  resolvedAt?: number;
}

const eventLog: EventLogEntry[] = [];
const approvalQueue = new Map<string, ApprovalEntry>();

export function appendEvent(raw: object): EventLogEntry {
  const entry: EventLogEntry = {
    id: uuid(),
    timestamp: Date.now(),
    raw,
  };
  eventLog.push(entry);
  return entry;
}

export function getEventLog(): EventLogEntry[] {
  return eventLog;
}

export function addPendingApproval(
  entry: Omit<ApprovalEntry, "status" | "timestamp">,
): void {
  if (approvalQueue.has(entry.permissionId)) {
    return;
  }

  approvalQueue.set(entry.permissionId, {
    ...entry,
    status: "pending",
    timestamp: Date.now(),
  });
}

export function resolveApproval(
  permissionId: string,
  resolution: "allow" | "deny",
): void {
  const entry = approvalQueue.get(permissionId);

  if (!entry) {
    throw new Error("Unknown permissionId");
  }

  entry.status = "resolved";
  entry.resolution = resolution;
  entry.resolvedAt = Date.now();
}

export function getPendingApprovals(): ApprovalEntry[] {
  return Array.from(approvalQueue.values()).filter(
    (entry) => entry.status === "pending",
  );
}
