import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../stores/appStore'

const getEventSessionId = (event) => {
  const properties = event?.properties || {}

  return (
    properties.sessionId ||
    properties.sessionID ||
    properties.info?.sessionId ||
    properties.info?.sessionID ||
    properties.part?.sessionId ||
    properties.part?.sessionID ||
    properties.message?.sessionId ||
    properties.message?.sessionID
  )
}

const getEventPermissionId = (event) => {
  const properties = event?.properties || {}

  return (
    properties.permissionId ||
    properties.permissionID ||
    properties.requestId ||
    properties.requestID ||
    properties.id ||
    properties.permission?.id
  )
}

const getApprovalDescription = (approvalOrEvent) => {
  const properties = approvalOrEvent?.properties || approvalOrEvent || {}

  if (
    typeof properties.description === 'string' &&
    properties.description.trim() !== ''
  ) {
    return properties.description
  }

  const permission =
    typeof properties.permission === 'string' ? properties.permission : ''
  const patterns = Array.isArray(properties.patterns)
    ? properties.patterns.filter((value) => typeof value === 'string')
    : []

  if (permission && patterns.length > 0) {
    return `${permission}: ${patterns.join(', ')}`
  }

  if (permission) {
    return `Permission required: ${permission}`
  }

  if (patterns.length > 0) {
    return `Permission request: ${patterns.join(', ')}`
  }

  return 'Permission request'
}

const normalizeApproval = (approval) => {
  if (!approval) {
    return null
  }

  const permissionId =
    approval.permissionId ||
    approval.permissionID ||
    approval.id ||
    approval.permission?.id
  const sessionId =
    approval.sessionId ||
    approval.sessionID ||
    approval.info?.sessionId ||
    approval.info?.sessionID

  if (!permissionId) {
    return null
  }

  return {
    ...approval,
    permissionId,
    sessionId: sessionId || null,
    description: getApprovalDescription(approval),
    status: approval.status || 'pending',
    timestamp: approval.timestamp || Date.now(),
  }
}

export const useSSE = () => {
  const currentSessionId = useAppStore((state) => state.currentSessionId)
  const setConnected = useAppStore((state) => state.setConnected)
  const setStatus = useAppStore((state) => state.setStatus)
  const setMessages = useAppStore((state) => state.setMessages)
  const setApproval = useAppStore((state) => state.setApproval)
  const setApprovals = useAppStore((state) => state.setApprovals)
  const removeApproval = useAppStore((state) => state.removeApproval)

  const eventSourceRef = useRef(null)
  const refreshTimeoutRef = useRef(null)
  const refreshAbortRef = useRef(null)
  const refreshSequenceRef = useRef(0)
  const currentSessionIdRef = useRef(currentSessionId)

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  const refreshMessages = useCallback(
    async (sessionId) => {
      if (!sessionId) {
        return
      }

      const requestSequence = refreshSequenceRef.current + 1
      refreshSequenceRef.current = requestSequence
      refreshAbortRef.current?.abort()
      const controller = new AbortController()
      refreshAbortRef.current = controller

      try {
        const response = await fetch(`/api/sessions/${sessionId}/messages`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('Failed to refresh messages')
        }

        const messages = await response.json()
        if (
          !controller.signal.aborted &&
          requestSequence === refreshSequenceRef.current &&
          currentSessionIdRef.current === sessionId
        ) {
          setMessages(messages)
        }
      } catch (error) {
        if (error?.name === 'AbortError') {
          return
        }
        console.error('Failed to refresh messages:', error)
      } finally {
        if (refreshAbortRef.current === controller) {
          refreshAbortRef.current = null
        }
      }
    },
    [setMessages],
  )

  const scheduleRefresh = useCallback(
    (sessionId) => {
      if (!sessionId || sessionId !== currentSessionIdRef.current) {
        return
      }

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }

      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null
        refreshMessages(sessionId)
      }, 150)
    },
    [refreshMessages],
  )

  const disconnect = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = null
    }

    refreshAbortRef.current?.abort()
    refreshAbortRef.current = null

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setConnected(false)
    setStatus('disconnected')
  }, [setConnected, setStatus])

  useEffect(() => {
    const es = new EventSource('/stream')
    eventSourceRef.current = es

    es.addEventListener('connected', () => {
      setConnected(true)
      setStatus('connected')
      if (currentSessionIdRef.current) {
        scheduleRefresh(currentSessionIdRef.current)
      }
    })

    es.addEventListener('approvals', (e) => {
      const data = JSON.parse(e.data)
      const approvals = (data.approvals || [])
        .map(normalizeApproval)
        .filter(Boolean)
      setApprovals(approvals)
    })

    es.addEventListener('opencode', (e) => {
      const event = JSON.parse(e.data)
      const sessionId = getEventSessionId(event)
      const permissionId = getEventPermissionId(event)

      if (event.type === 'permission.asked' && permissionId) {
        setApproval(permissionId, {
          permissionId,
          sessionId,
          description: getApprovalDescription(event),
          status: 'pending',
          timestamp: Date.now(),
        })
        return
      }

      if (
        (event.type === 'permission.resolved' ||
          event.type === 'permission.replied') &&
        permissionId
      ) {
        removeApproval(permissionId)
        return
      }

      if (sessionId) {
        scheduleRefresh(sessionId)
      }
    })

    es.onerror = (e) => {
      console.error('SSE error:', e)
      setConnected(false)
      setStatus('reconnecting')
    }

    return () => {
      if (eventSourceRef.current === es) {
        eventSourceRef.current = null
      }
      es.close()
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
      refreshAbortRef.current?.abort()
      refreshAbortRef.current = null
    }
  }, [
    removeApproval,
    scheduleRefresh,
    setApproval,
    setApprovals,
    setConnected,
    setStatus,
  ])

  return { disconnect }
}
