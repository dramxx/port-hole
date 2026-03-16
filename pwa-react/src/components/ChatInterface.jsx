import { useEffect, useRef } from "react";
import { useAppStore } from "../stores/appStore";
import { useAPI } from "../hooks/useAPI";
import { MessageList } from "./MessageList";
import { ApprovalPanel } from "./ApprovalPanel";

export const ChatInterface = () => {
  const { fetchSessions, fetchMessages, isLoading, error } = useAPI();
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const messages = useAppStore((state) => state.messages);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchSessions({ preferLatest: true });
  }, [fetchSessions]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchSessions({ preferLatest: true });
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchSessions]);

  useEffect(() => {
    if (currentSessionId) {
      fetchMessages(currentSessionId);
    }
  }, [currentSessionId, fetchMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [currentSessionId, messages]);

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

  if (isLoading && useAppStore.getState().sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-dark-muted">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (useAppStore.getState().sessions.length === 0) {
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
    <div ref={containerRef} className="h-full overflow-y-auto custom-scrollbar">
      <ApprovalPanel />
      <MessageList />
      {/* Spacer to prevent content from being hidden behind prompt bar */}
      <div className="h-20"></div>
    </div>
  );
};
