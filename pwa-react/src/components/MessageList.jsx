import { Clock, User, Bot, AlertCircle } from "lucide-react";
import { clsx } from "clsx";
import { useAppStore } from "../stores/appStore";

const formatToolValue = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
};

export const MessageList = () => {
  const messages = useAppStore((state) => state.messages);

  const formatTime = (timestamp) => {
    if (!timestamp) {
      return "unknown time";
    }

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
        return "bg-purple/20 ml-auto max-w-[80%] border-l-2 border-purple";
      case "assistant":
        return "bg-dark-secondary max-w-[80%]";
      default:
        return "bg-dark-tertiary max-w-[80%]";
    }
  };

  const renderContent = (parts) => {
    if (!Array.isArray(parts) || parts.length === 0) {
      return null;
    }

    const renderedParts = parts
      .map((part, index) => {
        const key = `${part.type || "part"}-${index}`;

        if (part.type === "text" && part.text) {
          return (
            <div key={key} className="whitespace-pre-wrap break-words">
              {part.text}
            </div>
          );
        }

        if (part.type === "reasoning" && part.text) {
          return (
            <div
              key={key}
              className="rounded border-l-2 border-yellow-400 bg-yellow-400/10 px-3 py-2 text-sm text-yellow-200 whitespace-pre-wrap break-words font-mono"
            >
              {part.text}
            </div>
          );
        }

        if (part.type === "tool") {
          const toolInput = formatToolValue(part.input);
          const toolOutput = formatToolValue(part.output);

          return (
            <details
              key={key}
              className="rounded bg-dark-tertiary/50 border border-dark-border p-2"
            >
              <summary className="cursor-pointer text-xs font-mono text-purple hover:text-purple-light">
                🔧 {part.name || "Tool"}
                {part.status ? ` (${part.status})` : ""}
              </summary>
              {toolInput ? (
                <div className="mt-2">
                  <div className="mb-1 text-xs uppercase tracking-wide text-dark-muted font-mono">
                    Input
                  </div>
                  <pre className="text-xs whitespace-pre-wrap break-words font-mono text-dark-muted">
                    {toolInput}
                  </pre>
                </div>
              ) : null}
              {toolOutput ? (
                <div className="mt-2">
                  <div className="mb-1 text-xs uppercase tracking-wide text-dark-muted font-mono">
                    Output
                  </div>
                  <pre className="text-xs whitespace-pre-wrap break-words font-mono text-dark-muted">
                    {toolOutput}
                  </pre>
                </div>
              ) : null}
            </details>
          );
        }

        return null;
      })
      .filter(Boolean);

    return renderedParts.length > 0 ? renderedParts : null;
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
    <div className="p-4 space-y-4">
      {messages.map((message, index) => {
        const role = message.role || "unknown";
        const timestamp = message.timestamp;
        const parts = message.parts || [];
        const content = renderContent(parts);

        if (!content) {
          return null;
        }

        return (
          <div
            key={message.id || index}
            className={clsx("flex flex-col rounded-lg p-3", getRoleClass(role))}
          >
            <div className="flex items-center gap-2 text-xs text-dark-muted mb-2">
              {getRoleIcon(role)}
              <span className="capitalize">{role}</span>
              <Clock className="w-3 h-3" />
              <span>{formatTime(timestamp)}</span>
            </div>
            <div className="space-y-2 text-sm leading-relaxed">{content}</div>
          </div>
        );
      })}
    </div>
  );
};
