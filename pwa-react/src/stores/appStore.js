import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// LocalStorage key for session persistence
const STORAGE_KEY = 'port-hole';

// Helper functions for localStorage persistence
function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to load from localStorage:', error)
  }
  return null
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to save to localStorage:', error)
  }
}

// Load persisted state
const persistedState = loadFromStorage()
const persistedSessionId = persistedState?.currentSessionId ?? null

export const useAppStore = create(
  subscribeWithSelector((set, get) => ({
    // Connection state
    isConnected: false,
    status: 'disconnected',

    // Session state - restored from localStorage if available
    sessions: [],
    currentSessionId: persistedSessionId,
    sessionSelectionMode: 'auto',
    messages: [],

    // Approval state
    approvals: new Map(),

    // UI state
    promptInput: '',
    isSending: false,

    // Actions
    setConnected: (connected) => set({ isConnected: connected }),
    setStatus: (status) => set({ status }),

    setSessions: (sessions) => set({ sessions }),
    setCurrentSessionId: (id, mode = 'manual') => {
      set({ currentSessionId: id, sessionSelectionMode: mode })
      saveToStorage({ currentSessionId: id })
    },

    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((state) => ({
      messages: [...state.messages, message]
    })),
    setApprovals: (approvals) =>
      set({
        approvals: new Map(
          approvals.map((approval) => [approval.permissionId, approval]),
        ),
      }),

    setApproval: (permissionId, approval) => set((state) => {
      const newApprovals = new Map(state.approvals)
      newApprovals.set(permissionId, approval)
      return { approvals: newApprovals }
    }),

    removeApproval: (permissionId) => set((state) => {
      const newApprovals = new Map(state.approvals)
      newApprovals.delete(permissionId)
      return { approvals: newApprovals }
    }),

    setPromptInput: (prompt) => set({ promptInput: prompt }),
    setSending: (sending) => set({ isSending: sending }),

    // Reset actions - clear everything on disconnect/server restart
    clearSession: () => {
      localStorage.removeItem(STORAGE_KEY)
      set({
        currentSessionId: null,
        sessionSelectionMode: 'auto',
        messages: [],
        approvals: new Map(),
        promptInput: '',
        isSending: false,
      })
    },
    reset: () => {
      localStorage.removeItem(STORAGE_KEY)
      set({
        isConnected: false,
        status: 'disconnected',
        sessions: [],
        currentSessionId: null,
        sessionSelectionMode: 'auto',
        messages: [],
        approvals: new Map(),
        promptInput: '',
        isSending: false,
      })
    }
  }))
)
