import { Clock, User, Bot, AlertCircle } from "lucide-react";
import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import { useAppStore } from "../stores/appStore";

export const MessageList = () => {
  const { messages } = useAppStore();
  const containerRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !shouldStickToBottomRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [messages]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 50;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "unknown time";
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "user":
        return <User className="w-4 h-4" />;
      case "assistant":
        return <Bot className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getRoleClass = (role) => {
    switch (role) {
      case "user":
        return "bg-blue-900 ml-auto max-w-[80%]";
      case "assistant":
        return "bg-dark-secondary max-w-[80%]";
      default:
        return "bg-gray-800 max-w-[80%]";
    }
  };

  const renderContent = (parts) => {
    if (!parts || parts.length === 0) return <em>No content</em>;

    return parts.map((part, index) => {
      switch (part.type) {
        case "text":
          return <span key={index}>{part.text}</span>;
        case "tool_use":
          return (
            <details key={index} className="bg-dark-tertiary p-2 rounded mt-2">
              <summary className="cursor-pointer font-mono text-sm">
                🔧 {part.name || "Tool"}
              </summary>
              <pre className="text-xs mt-2 whitespace-pre-wrap">
                {JSON.stringify(part.input, null, 2)}
              </pre>
            </details>
          );
        case "tool_result":
          return (
            <details key={index} className="bg-dark-tertiary p-2 rounded mt-2">
              <summary className="cursor-pointer text-sm">📋 Result</summary>
              <pre className="text-xs mt-2 whitespace-pre-wrap">
                {part.content || ""}
              </pre>
            </details>
          );
        default:
          return (
            <details key={index} className="bg-dark-tertiary p-2 rounded mt-2">
              <summary className="cursor-pointer text-sm">{part.type}</summary>
              <pre className="text-xs mt-2 whitespace-pre-wrap">
                {JSON.stringify(part, null, 2)}
              </pre>
            </details>
          );
      }
    });
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-dark-muted">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No messages yet. Start a conversation!</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4"
    >
      {messages.map((message, index) => {
        const role = message.info?.role || message.role || "unknown";
        const timestamp = message.info?.time?.created || message.timestamp;
        const parts = message.parts || [];

        return (
          <div
            key={index}
            className={clsx("flex flex-col rounded-lg p-3", getRoleClass(role))}
          >
            <div className="flex items-center gap-2 text-xs text-dark-muted mb-2">
              {getRoleIcon(role)}
              <span className="capitalize">{role}</span>
              <Clock className="w-3 h-3" />
              <span>{formatTime(timestamp)}</span>
            </div>
            <div className="text-sm leading-relaxed">
              {renderContent(parts)}
            </div>
          </div>
        );
      })}
    </div>
  );
};
