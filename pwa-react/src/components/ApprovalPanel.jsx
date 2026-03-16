import { CheckCircle, XCircle, Clock } from "lucide-react";
import { clsx } from "clsx";
import { useAppStore } from "../stores/appStore";
import { useAPI } from "../hooks/useAPI";

export const ApprovalPanel = () => {
  const approvals = useAppStore((state) => state.approvals);
  const removeApproval = useAppStore((state) => state.removeApproval);
  const { sendApproval } = useAPI();

  const pendingApprovals = Array.from(approvals.values()).filter(
    (approval) => approval.status === "pending",
  );

  const formatWaitingTime = (timestamp) => {
    const elapsed = Math.floor((Date.now() - timestamp) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const handleApproval = async (approval, allow) => {
    if (!approval?.sessionId || !approval?.permissionId) {
      return;
    }

    const success = await sendApproval(
      approval.sessionId,
      approval.permissionId,
      allow,
    );
    if (success) {
      removeApproval(approval.permissionId);
    }
  };

  if (pendingApprovals.length === 0) {
    return null;
  }

  return (
    <div className="bg-yellow-400/10 border-b border-yellow-400/30 p-4 max-h-40 overflow-y-auto custom-scrollbar">
      <div className="space-y-3">
        {pendingApprovals.map((approval) => (
          <div
            key={approval.permissionId}
            className="bg-yellow-400/5 border border-yellow-400/20 rounded-lg p-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-yellow-200 mb-2 font-mono">
                  {approval.description || "Unknown permission request"}
                </p>
                <div className="flex items-center gap-2 text-xs text-yellow-300 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>waiting {formatWaitingTime(approval.timestamp)}</span>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleApproval(approval, true)}
                  disabled={!approval.sessionId || !approval.permissionId}
                  className={clsx(
                    "px-3 py-1 rounded text-xs font-medium font-mono",
                    "bg-green-600 hover:bg-green-700 text-white",
                    "transition-colors duration-200",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  Allow
                </button>
                <button
                  onClick={() => handleApproval(approval, false)}
                  disabled={!approval.sessionId || !approval.permissionId}
                  className={clsx(
                    "px-3 py-1 rounded text-xs font-medium font-mono",
                    "bg-red-600 hover:bg-red-700 text-white",
                    "transition-colors duration-200",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  <XCircle className="w-3 h-3 inline mr-1" />
                  Deny
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
