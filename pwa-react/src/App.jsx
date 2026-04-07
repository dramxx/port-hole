import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { ChatInterface } from "./components/ChatInterface";
import { PromptInput } from "./components/PromptInput";
import { ApprovalPanel } from "./components/ApprovalPanel";
import { useSSE } from "./hooks/useSSE";
import { APIProvider } from "./hooks/useSharedAPI";

function App() {
  const { disconnect } = useSSE();

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <APIProvider>
      <div className="h-screen-keyboard-safe bg-dark text-white flex flex-col">
        {/* Fixed TopBar - stuck to top */}
        <div className="flex-shrink-0 sticky top-0 z-50">
          <TopBar />
        </div>

        {/* ApprovalPanel - shows when permissions pending */}
        <div className="flex-shrink-0 z-45">
          <ApprovalPanel />
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
    </APIProvider>
  );
}

export default App;
