import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { ChatInterface } from "./components/ChatInterface";
import { PromptInput } from "./components/PromptInput";
import { useSSE } from "./hooks/useSSE";

function App() {
  const { disconnect } = useSSE();

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <div className="h-screen-keyboard-safe bg-dark text-dark-text flex flex-col">
      {/* Fixed TopBar */}
      <div className="flex-shrink-0">
        <TopBar />
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <ChatInterface />
      </div>

      {/* Fixed bottom prompt area */}
      <div className="flex-shrink-0 border-t border-dark-border bg-dark-secondary">
        <PromptInput />
      </div>
    </div>
  );
}

export default App;
