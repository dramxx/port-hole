import { useAppStore } from "../stores/appStore";
import { StatusIndicator } from "./StatusIndicator";
import { CircleDot, RefreshCw } from "lucide-react";
import { useAPI } from "../hooks/useAPI";
import { useState } from "react";

export const TopBar = () => {
  const sessions = useAppStore((state) => state.sessions);
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const setCurrentSessionId = useAppStore((state) => state.setCurrentSessionId);
  const { fetchSessions } = useAPI();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSessionChange = (sessionId) => {
    setCurrentSessionId(sessionId, "manual");
  };

  const handleRefreshSessions = async () => {
    setIsRefreshing(true);
    await fetchSessions({ preferLatest: true });
    setIsRefreshing(false);
  };

  return (
    <div className="bg-dark border-b border-dark-border">
      {/* First row: Logo and status */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-purple rounded flex items-center justify-center">
              <CircleDot className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-medium text-white">port-hole</h1>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center flex-shrink-0">
          <StatusIndicator />
        </div>
      </div>

      {/* Second row: Session selector */}
      <div className="px-4 py-2 border-t border-dark-border">
        <div className="flex items-center gap-2">
          <label className="text-xs text-dark-muted uppercase tracking-wide whitespace-nowrap flex-shrink-0">
            Session
          </label>
          <select
            value={currentSessionId || ""}
            onChange={(e) => handleSessionChange(e.target.value)}
            className="px-2 py-1 rounded text-xs bg-dark-secondary border border-dark-border text-white focus:outline-none focus:ring-1 focus:ring-purple flex-1 min-w-0"
          >
            {sessions.map((session) => (
              <option
                key={session.id}
                value={session.id}
                className="bg-dark-secondary text-white"
              >
                {(session.title || session.id).length > 30
                  ? (session.title || session.id).substring(0, 30) + "..."
                  : session.title || session.id}
              </option>
            ))}
          </select>
          <button
            onClick={handleRefreshSessions}
            disabled={isRefreshing}
            className="p-1 rounded text-dark-muted hover:text-white hover:bg-dark-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            title="Refresh sessions"
          >
            <RefreshCw
              className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
