import { Send, Square, RefreshCw } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { useAppStore } from "../stores/appStore";
import { useAPI } from "../hooks/useAPI";

export const PromptInput = () => {
  const { currentSessionId, promptInput, setPromptInput, setSending } =
    useAppStore();

  const { sendPrompt, abortSession } = useAPI();
  const [isSending, setIsSendingLocal] = useState(false);

  const handleSend = async () => {
    if (!promptInput.trim() || !currentSessionId) return;

    setIsSendingLocal(true);
    setSending(true);

    const success = await sendPrompt(currentSessionId, promptInput.trim());

    if (success) {
      setPromptInput("");
    }

    setIsSendingLocal(false);
    setSending(false);
  };

  const handleAbort = async () => {
    if (!currentSessionId) return;
    await abortSession(currentSessionId);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-dark-border p-4 space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            currentSessionId ? "Type your prompt..." : "Select a session..."
          }
          disabled={!currentSessionId || isSending}
          className={clsx(
            "flex-1 px-3 py-2 rounded-lg text-sm",
            "bg-dark-secondary border border-dark-border",
            "placeholder-dark-muted",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        />
        <button
          onClick={handleSend}
          disabled={!promptInput.trim() || !currentSessionId || isSending}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium",
            "bg-blue-600 hover:bg-blue-700 text-white",
            "transition-colors duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center gap-2",
          )}
        >
          {isSending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {isSending ? "Sending..." : "Send"}
        </button>
        <button
          onClick={handleAbort}
          disabled={!currentSessionId}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium",
            "bg-red-600 hover:bg-red-700 text-white",
            "transition-colors duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center gap-2",
          )}
        >
          <Square className="w-4 h-4" />
          Abort
        </button>
      </div>
    </div>
  );
};
