import { createContext, useContext } from 'react';
import { useAPI } from '../hooks/useAPI';

// Create a context for the shared API hook
const APIContext = createContext(null);

// Provider component that wraps the app and provides a single shared API instance
export function APIProvider({ children }) {
  const api = useAPI();
  
  return (
    <APIContext.Provider value={api}>
      {children}
    </APIContext.Provider>
  );
}

// Hook to use the shared API instance
export function useSharedAPI() {
  const context = useContext(APIContext);
  if (!context) {
    // Fallback to useAPI if used outside provider (for testing or edge cases)
    return useAPI();
  }
  return context;
}
