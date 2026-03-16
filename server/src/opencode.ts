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

export interface MessageWithParts {
  id: string;
  role: string;
  parts: Array<{ type: string; text?: string; [key: string]: any }>;
  timestamp: number;
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
): Promise<MessageWithParts[]> {
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
  console.log(
    `Bridge sending to OpenCode: ${BASE_URL}/session/${sessionId}/prompt_async`,
  );
  console.log("Bridge prompt data:", { parts: [{ type: "text", text }] });

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

  console.log("Bridge OpenCode response status:", response.status);
  if (!response.ok) {
    const errorText = await response.text();
    console.log("Bridge OpenCode error:", errorText);
    throw new OpenCodeError(
      response.status,
      `Failed to send prompt: ${response.statusText}`,
    );
  }

  console.log("Bridge prompt sent successfully");
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
