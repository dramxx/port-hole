import { useAppStore } from "../stores/appStore";
import { StatusIndicator } from "./StatusIndicator";
import { CircleDot } from "lucide-react";

export const TopBar = () => {
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const sessions = useAppStore((state) => state.sessions);

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const sessionName =
    currentSession?.title || currentSession?.slug || currentSessionId;

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

      {/* Second row: Session display (read-only) */}
      <div className="px-4 py-2 border-t border-dark-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-muted uppercase tracking-wide whitespace-nowrap flex-shrink-0">
            Session
          </span>
          <span className="px-2 py-1 rounded text-xs bg-dark-secondary border border-dark-border text-white flex-1 min-w-0 truncate font-mono">
            {sessionName || "< waiting for opencode >"}
          </span>
        </div>
      </div>
    </div>
  );
};
