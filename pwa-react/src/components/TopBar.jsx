import { useAppStore } from "../stores/appStore";
import { StatusIndicator } from "./StatusIndicator";
import { CircleDot } from "lucide-react";

export const TopBar = () => {
  const sessions = useAppStore((state) => state.sessions);
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const setCurrentSessionId = useAppStore((state) => state.setCurrentSessionId);

  const handleSessionChange = (sessionId) => {
    setCurrentSessionId(sessionId);
  };

  return (
    <div className="bg-dark-secondary border-b border-dark-border">
      {/* First row: Logo and connection status */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Logo */}
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <CircleDot className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-dark-text">port-hole</h1>
          </div>
        </div>

        <div className="flex items-center flex-shrink-0">
          <StatusIndicator />
        </div>
      </div>

      {/* Second row: Session selector only */}
      <div className="px-4 py-2 border-t border-dark-border">
        <div className="flex items-center gap-3">
          <label className="text-xs text-dark-muted uppercase tracking-wide whitespace-nowrap flex-shrink-0">
            Session
          </label>
          <select
            value={currentSessionId || ""}
            onChange={(e) => handleSessionChange(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm bg-dark-tertiary border border-dark-border text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0"
          >
            {sessions.map((session) => (
              <option
                key={session.id}
                value={session.id}
                className="text-overflow-ellipsis"
              >
                {(session.title || session.id).length > 30
                  ? (session.title || session.id).substring(0, 30) + "..."
                  : session.title || session.id}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
