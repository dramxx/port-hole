import { Wifi, WifiOff, AlertCircle, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { useAppStore } from "../stores/appStore";

export const StatusIndicator = () => {
  const status = useAppStore((state) => state.status);

  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: Wifi,
          color: "text-purple",
          bgColor: "bg-purple",
          text: "Connected",
        };
      case "reconnecting":
        return {
          icon: Loader2,
          color: "text-yellow-400",
          bgColor: "bg-yellow-400",
          text: "Reconnecting",
          animate: true,
        };
      case "error":
        return {
          icon: AlertCircle,
          color: "text-red-400",
          bgColor: "bg-red-400",
          text: "Error",
        };
      default:
        return {
          icon: WifiOff,
          color: "text-dark-muted",
          bgColor: "bg-dark-muted",
          text: "Disconnected",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <div className={clsx("relative", config.animate && "animate-pulse")}>
        <Icon className={clsx("w-5 h-5", config.color)} />
      </div>
      <span className="text-xs text-dark-muted font-mono">{config.text}</span>
    </div>
  );
};
