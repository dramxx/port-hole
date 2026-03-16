import { useEffect } from "react";
import { ChatInterface } from "./components/ChatInterface";
import { useSSE } from "./hooks/useSSE";

function App() {
  const { disconnect } = useSSE();

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <div className="h-screen bg-dark text-dark-text flex flex-col">
      <ChatInterface />
    </div>
  );
}

export default App;
