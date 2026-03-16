import { Send, RefreshCw, StopCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { clsx } from "clsx";
import { useAppStore } from "../stores/appStore";
import { useAPI } from "../hooks/useAPI";

export const PromptInput = () => {
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const promptInput = useAppStore((state) => state.promptInput);
  const setPromptInput = useAppStore((state) => state.setPromptInput);
  const setSending = useAppStore((state) => state.setSending);

  const { sendPrompt, abortSession } = useAPI();
  const [isSending, setIsSendingLocal] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [promptInput]);

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

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-dark-border bg-dark-secondary p-2 sm:p-4">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            currentSessionId ? "Type your prompt..." : "Select a session..."
          }
          disabled={!currentSessionId || isSending}
          className={clsx(
            "flex-1 px-2 py-2 sm:px-3 sm:py-2 rounded-lg text-sm font-mono resize-none overflow-hidden",
            "bg-dark border border-dark-border",
            "placeholder-dark-muted",
            "focus:outline-none focus:ring-1 focus:ring-purple focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "min-h-[36px] sm:min-h-[40px] max-h-[100px] sm:max-h-[120px]",
          )}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!promptInput.trim() || !currentSessionId || isSending}
          className={clsx(
            "px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium font-mono",
            "bg-purple hover:bg-purple-dark text-white",
            "transition-colors duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center gap-1 sm:gap-2",
            "flex-shrink-0",
          )}
        >
          {isSending ? (
            <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
          ) : (
            <Send className="w-3 h-3 sm:w-4 sm:h-4" />
          )}
          <span className="hidden sm:inline">
            {isSending ? "Sending..." : "Send"}
          </span>
        </button>
        <button
          onClick={handleAbort}
          disabled={!currentSessionId}
          className={clsx(
            "p-1.5 sm:p-2 rounded-lg text-sm font-medium",
            "bg-red-600 hover:bg-red-700 text-white",
            "transition-colors duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center justify-center",
            "w-8 h-8 sm:w-11 sm:h-11 sm:min-w-[44px] sm:min-h-[44px]", // Touch-friendly size
            "flex-shrink-0",
          )}
          title="Abort session"
        >
          <StopCircle className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
  );
};
