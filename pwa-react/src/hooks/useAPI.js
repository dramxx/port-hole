import { useCallback, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'

const getSessionUpdatedAt = (session) =>
  session.updatedAt ?? session.time?.updated ?? session.time?.created ?? 0

const getErrorMessage = (error, fallback) =>
  error instanceof Error ? error.message : fallback

export const useAPI = () => {
  const setStatus = useAppStore((state) => state.setStatus)
  const setSessions = useAppStore((state) => state.setSessions)
  const setMessages = useAppStore((state) => state.setMessages)
  const [isLoading, setIsLoading] = useState(false)
  // Separate error states per operation to avoid overwrites
  const [sessionError, setSessionError] = useState(null)
  const [messageError, setMessageError] = useState(null)
  const [promptError, setPromptError] = useState(null)
  const [approvalError, setApprovalError] = useState(null)
  const messagesAbortRef = useRef(null)
  const messagesRequestRef = useRef(0)

  const fetchMessages = useCallback(
    async (sessionId) => {
      try {
        setIsLoading(true)
        setMessageError(null)

        if (!sessionId) {
          setMessages([])
          return []
        }

        const requestId = messagesRequestRef.current + 1
        messagesRequestRef.current = requestId
        messagesAbortRef.current?.abort()
        const controller = new AbortController()
        messagesAbortRef.current = controller

        const response = await fetch(`/api/sessions/${sessionId}/messages`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('Failed to fetch messages')
        }

        const messages = await response.json()
        if (
          !controller.signal.aborted &&
          requestId === messagesRequestRef.current
        ) {
          setMessages(messages)
        }
        return messages
      } catch (err) {
        if (err?.name === 'AbortError') {
          return []
        }
        setMessageError(getErrorMessage(err, 'Failed to fetch messages'))
        return []
      } finally {
        setIsLoading(false)
      }
    },
    [setMessages],
  )

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true)
      setSessionError(null)

      const response = await fetch('/api/sessions')
      if (!response.ok) {
        throw new Error('Failed to fetch sessions')
      }

      const sessions = await response.json()

      // Filter out sessions older than 24 hours to prevent list bloat
      const ONE_DAY_MS = 24 * 60 * 60 * 1000
      const cutoffTime = Date.now() - ONE_DAY_MS
      const recentSessions = sessions.filter((s) => {
        const updatedAt = s.time?.updated || s.time?.created || s.updatedAt || 0
        return updatedAt > cutoffTime
      })

      const sortedSessions = [...recentSessions].sort(
        (a, b) => getSessionUpdatedAt(b) - getSessionUpdatedAt(a)
      )

      setSessions(sortedSessions)
      return sortedSessions
    } catch (err) {
      setSessionError(getErrorMessage(err, 'Failed to fetch sessions'))
      setStatus('error')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [setSessions, setStatus])

  const sendPrompt = useCallback(async (sessionId, text) => {
    try {
      setPromptError(null)
      const response = await fetch(`/api/sessions/${sessionId}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!response.ok) {
        throw new Error('Failed to send prompt')
      }
      return true
    } catch (err) {
      setPromptError(getErrorMessage(err, 'Failed to send prompt'))
      return false
    }
  }, [])

  const sendApproval = useCallback(async (sessionId, permissionId, allow) => {
    try {
      setApprovalError(null)
      if (!sessionId || !permissionId) {
        throw new Error('Missing approval identifiers')
      }
      const response = await fetch(
        `/api/sessions/${sessionId}/approve/${permissionId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allow }),
        },
      )
      if (!response.ok) {
        throw new Error('Failed to send approval')
      }
      return true
    } catch (err) {
      setApprovalError(getErrorMessage(err, 'Failed to send approval'))
      return false
    }
  }, [])

  return {
    fetchSessions,
    fetchMessages,
    sendPrompt,
    sendApproval,
    isLoading,
    error: sessionError || messageError || promptError || approvalError,
  }
}
