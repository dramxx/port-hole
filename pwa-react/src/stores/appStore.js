import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export const useAppStore = create(
  subscribeWithSelector((set, get) => ({
    // Connection state
    isConnected: false,
    status: 'disconnected',

    // Session state
    sessions: [],
    currentSessionId: null,
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
    setCurrentSessionId: (id) => set({ currentSessionId: id }),

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

    // Reset actions
    reset: () => set({
      isConnected: false,
      status: 'disconnected',
      sessions: [],
      currentSessionId: null,
      messages: [],
      approvals: new Map(),
      promptInput: '',
      isSending: false,
    })
  }))
)
