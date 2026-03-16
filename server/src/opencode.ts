import EventSource from "eventsource";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const BASE_URL = `http://${process.env.OPENCODE_HOST}:${process.env.OPENCODE_PORT}`;

export class OpenCodeError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Session {
  id: string;
  title?: string;
  updatedAt: number;
}

export interface OpenCodeMessagePart {
  type?: string;
  text?: string;
  content?: unknown;
  input?: unknown;
  output?: unknown;
  name?: string;
  tool?: string;
  callID?: string;
  state?: {
    status?: string;
    input?: unknown;
    output?: unknown;
    result?: unknown;
    [key: string]: unknown;
  };
  [key: string]: any;
}

export interface OpenCodeMessageInfo {
  id?: string;
  role?: string;
  time?: {
    created?: number;
    updated?: number;
    [key: string]: unknown;
  };
  [key: string]: any;
}

export interface OpenCodeMessage {
  id?: string;
  role?: string;
  timestamp?: number;
  info?: OpenCodeMessageInfo;
  parts?: OpenCodeMessagePart[];
  [key: string]: any;
}

export async function health(): Promise<{ healthy: boolean; version: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(`${BASE_URL}/global/health`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new OpenCodeError(
        response.status,
        `Health check failed: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new OpenCodeError(408, "Health check timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSessions(): Promise<Session[]> {
  const response = await fetch(`${BASE_URL}/session`);

  if (!response.ok) {
    throw new OpenCodeError(
      response.status,
      `Failed to get sessions: ${response.statusText}`,
    );
  }

  return await response.json();
}

export async function getMessages(
  sessionId: string,
): Promise<OpenCodeMessage[]> {
  const response = await fetch(`${BASE_URL}/session/${sessionId}/message`);

  if (!response.ok) {
    throw new OpenCodeError(
      response.status,
      `Failed to get messages: ${response.statusText}`,
    );
  }

  return await response.json();
}

export async function sendPrompt(
  sessionId: string,
  text: string,
): Promise<void> {
  const response = await fetch(
    `${BASE_URL}/session/${sessionId}/prompt_async`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parts: [{ type: "text", text }],
      }),
    },
  );

  if (!response.ok) {
    throw new OpenCodeError(
      response.status,
      `Failed to send prompt: ${response.statusText}`,
    );
  }
}

export async function approvePermission(
  sessionId: string,
  permissionId: string,
  allow: boolean,
): Promise<void> {
  const responseValue = allow ? "once" : "reject";
  const response = await fetch(
    `${BASE_URL}/session/${sessionId}/permissions/${permissionId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response: responseValue,
      }),
    },
  );

  if (!response.ok) {
    throw new OpenCodeError(
      response.status,
      `Failed to approve permission: ${response.statusText}`,
    );
  }
}

export async function abortSession(sessionId: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/session/${sessionId}/abort`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new OpenCodeError(
      response.status,
      `Failed to abort session: ${response.statusText}`,
    );
  }
}

export function subscribeToEvents(
  onEvent: (event: object) => void,
): () => void {
  let es: EventSource | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let shouldReconnect = true;

  function connect() {
    es = new EventSource(`${BASE_URL}/event`);

    es.onmessage = (event: any) => {
      try {
        const parsed = JSON.parse(event.data);
        onEvent(parsed);
      } catch (error) {
        console.error("Failed to parse SSE event:", error);
      }
    };

    es.onerror = () => {
      es?.close();
      if (shouldReconnect) {
        reconnectTimer = setTimeout(connect, 1000);
      }
    };
  }

  connect();

  return () => {
    shouldReconnect = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    es?.close();
  };
}
