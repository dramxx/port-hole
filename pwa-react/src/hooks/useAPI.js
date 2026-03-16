import { useCallback, useState } from 'react'
import { useAppStore } from '../stores/appStore'

const getSessionUpdatedAt = (session) =>
  session.updatedAt ?? session.time?.updated ?? session.time?.created ?? 0

export const useAPI = () => {
  const {
    setStatus,
    setSessions,
    setMessages,
    setCurrentSessionId,
  } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchMessages = useCallback(async (sessionId) => {
    try {
      setIsLoading(true)
      setError(null)

      if (!sessionId) {
        setMessages([])
        return []
      }

      const response = await fetch(`/api/sessions/${sessionId}/messages`)
      if (!response.ok) throw new Error('Failed to fetch messages')

      const messages = await response.json()
      setMessages(messages)
      return messages
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [setMessages])

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/sessions')
      if (!response.ok) throw new Error('Failed to fetch sessions')

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
      setError(err.message)
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
      if (!response.ok) throw new Error('Failed to send prompt')
      return true
    } catch (err) {
      setError(err.message)
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
      if (!response.ok) throw new Error('Failed to send approval')
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }, [])

  const abortSession = useCallback(async (sessionId) => {
    try {
      setError(null)
      const response = await fetch(`/api/sessions/${sessionId}/abort`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to abort session')
      return true
    } catch (err) {
      setError(err.message)
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
