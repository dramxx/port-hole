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
    <div className="h-screen-keyboard-safe bg-dark text-white flex flex-col">
      {/* Fixed TopBar - stuck to top */}
      <div className="flex-shrink-0 sticky top-0 z-50">
        <TopBar />
      </div>

      {/* Scrollable content area - takes remaining space */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>

      {/* Fixed bottom prompt area - stuck to bottom */}
      <div className="flex-shrink-0 sticky bottom-0 z-40">
        <PromptInput />
      </div>
    </div>
  );
}

export default App;
