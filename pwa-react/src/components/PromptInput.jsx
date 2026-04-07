import { Send, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { clsx } from "clsx";
import { useAppStore } from "../stores/appStore";
import { useSharedAPI } from "../hooks/useSharedAPI";

export const PromptInput = () => {
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const promptInput = useAppStore((state) => state.promptInput);
  const setPromptInput = useAppStore((state) => state.setPromptInput);
  const setSending = useAppStore((state) => state.setSending);
  const messages = useAppStore((state) => state.messages);

  const { sendPrompt } = useSharedAPI();
  const [isSending, setIsSendingLocal] = useState(false);
  const [lastFailedPrompt, setLastFailedPrompt] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const textareaRef = useRef(null);
  const lastSentSessionRef = useRef(null);
  const lastMessageCountRef = useRef(0);

  // Clear waiting state when assistant responds
  useEffect(() => {
    if (isWaitingForResponse && messages.length > lastMessageCountRef.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant") {
        setIsWaitingForResponse(false);
      }
    }
    lastMessageCountRef.current = messages.length;
  }, [messages, isWaitingForResponse]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [promptInput]);

  const handleSend = async (retryPrompt = null) => {
    const textToSend = retryPrompt ?? promptInput;
    if (!textToSend.trim() || !currentSessionId) return;

    setIsSendingLocal(true);
    setSending(true);
    setSendError(null);
    setIsWaitingForResponse(true);
    lastSentSessionRef.current = currentSessionId;

    const success = await sendPrompt(currentSessionId, textToSend.trim());

    if (success) {
      setPromptInput("");
      setLastFailedPrompt(null);
      // Keep isWaitingForResponse true until SSE event arrives
    } else {
      setLastFailedPrompt(textToSend.trim());
      setSendError("Failed to send prompt. Tap retry to try again.");
      setIsWaitingForResponse(false);
    }

    setIsSendingLocal(false);
    setSending(false);
  };

  // Allow manual clear of waiting state if user wants to send again
  const handleWaitingClear = () => {
    setIsWaitingForResponse(false);
    lastSentSessionRef.current = null;
  };

  const handleRetry = () => {
    if (lastFailedPrompt) {
      handleSend(lastFailedPrompt);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isWaiting = isWaitingForResponse && !sendError;

  return (
    <div className="border-t border-dark-border bg-dark-secondary p-2 sm:p-4">
      {/* Error message with retry */}
      {sendError && lastFailedPrompt && (
        <div className="mb-2 flex items-center justify-between text-xs text-red-400 bg-red-400/10 rounded px-2 py-1">
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>{sendError}</span>
          </div>
          <button
            onClick={handleRetry}
            disabled={isSending}
            className="text-red-300 hover:text-red-200 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Waiting for response indicator */}
      {isWaiting && (
        <div className="mb-2 flex items-center justify-between text-xs text-yellow-400 bg-yellow-400/10 rounded px-2 py-1">
          <div className="flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Waiting for response...</span>
          </div>
          <button
            onClick={handleWaitingClear}
            className="text-yellow-300 hover:text-yellow-200 underline"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            currentSessionId
              ? "Type your prompt..."
              : "Waiting for OpenCode session..."
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
          onClick={() => handleSend()}
          disabled={!promptInput.trim() || !currentSessionId || isSending}
          className={clsx(
            "w-10 h-10 sm:w-11 sm:h-11 rounded-lg text-sm font-medium",
            isWaiting
              ? "bg-yellow-600 hover:bg-yellow-700"
              : "bg-purple hover:bg-purple-dark",
            "text-white",
            "transition-colors duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center justify-center",
            "flex-shrink-0",
          )}
        >
          {isSending ? (
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
          ) : isWaiting ? (
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
          ) : (
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>
      </div>
    </div>
  );
};
