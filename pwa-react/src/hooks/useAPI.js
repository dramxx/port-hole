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
  const setCurrentSessionId = useAppStore((state) => state.setCurrentSessionId)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const messagesAbortRef = useRef(null)
  const messagesRequestRef = useRef(0)

  const fetchMessages = useCallback(
    async (sessionId) => {
      try {
        setIsLoading(true)
        setError(null)

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
        setError(getErrorMessage(err, 'Failed to fetch messages'))
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
      setError(null)

      const response = await fetch('/api/sessions')
      if (!response.ok) {
        throw new Error('Failed to fetch sessions')
      }

      const sessions = await response.json()
      const sortedSessions = [...sessions].sort(
        (a, b) => getSessionUpdatedAt(b) - getSessionUpdatedAt(a),
      )

      setSessions(sortedSessions)

      if (sortedSessions.length === 0) {
        setCurrentSessionId(null)
        setMessages([])
        return []
      }

      const currentSelectedId = useAppStore.getState().currentSessionId
      const selectedSessionId = sortedSessions.some(
        (session) => session.id === currentSelectedId,
      )
        ? currentSelectedId
        : sortedSessions[0].id

      if (selectedSessionId !== currentSelectedId) {
        setCurrentSessionId(selectedSessionId)
      }

      return sortedSessions
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch sessions'))
      setStatus('error')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [setCurrentSessionId, setMessages, setSessions, setStatus])

  const sendPrompt = useCallback(async (sessionId, text) => {
    try {
      setError(null)
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
      setError(getErrorMessage(err, 'Failed to send prompt'))
      return false
    }
  }, [])

  const sendApproval = useCallback(async (sessionId, permissionId, allow) => {
    try {
      setError(null)
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
      setError(getErrorMessage(err, 'Failed to send approval'))
      return false
    }
  }, [])

  const abortSession = useCallback(async (sessionId) => {
    try {
      setError(null)
      const response = await fetch(`/api/sessions/${sessionId}/abort`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to abort session')
      }
      return true
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to abort session'))
      return false
    }
  }, [])

  return {
    fetchSessions,
    fetchMessages,
    sendPrompt,
    sendApproval,
    abortSession,
    isLoading,
    error,
  }
}
