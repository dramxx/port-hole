import { useEffect } from "react";
import { useAppStore } from "../stores/appStore";
import { useAPI } from "../hooks/useAPI";
import { StatusIndicator } from "./StatusIndicator";
import { MessageList } from "./MessageList";
import { ApprovalPanel } from "./ApprovalPanel";
import { PromptInput } from "./PromptInput";

export const ChatInterface = () => {
  const sessions = useAppStore((state) => state.sessions);
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const setCurrentSessionId = useAppStore((state) => state.setCurrentSessionId);

  const { fetchSessions, fetchMessages, isLoading, error } = useAPI();

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (currentSessionId) {
      fetchMessages(currentSessionId);
    }
  }, [currentSessionId, fetchMessages]);

  const handleSessionChange = (sessionId) => {
    setCurrentSessionId(sessionId);
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-red-500">
          <p className="mb-2">Connection error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading && sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-dark-muted">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-dark-muted">
          <p>No active sessions</p>
          <p className="text-sm">Start a session in OpenCode on your PC</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-dark-secondary border-b border-dark-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">port-hole</h1>
            <StatusIndicator />
          </div>

          <select
            value={currentSessionId || ""}
            onChange={(e) => handleSessionChange(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm bg-dark-tertiary border border-dark-border text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title || session.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ApprovalPanel />
      <MessageList />
      <PromptInput />
    </div>
  );
};
