'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null
  if (!socket) {
    socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
  }
  return socket
}

/** Watch an equipment's availability in real-time. Falls back to polling if socket fails. */
export function useAvailabilitySocket(equipmentId: string | undefined, onPoll?: () => void) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!equipmentId) return
    const s = getSocket()
    if (!s) return

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))

    s.emit('watch:equipment', equipmentId)

    // Fallback: poll every 30s if not connected
    let pollInterval: ReturnType<typeof setInterval> | null = null
    if (!s.connected && onPoll) {
      pollInterval = setInterval(onPoll, 30000)
    }

    return () => {
      s.emit('unwatch:equipment', equipmentId)
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [equipmentId, onPoll])

  return connected
}

/** Subscribe to availability updates for a specific equipment */
export function useAvailabilityUpdates(equipmentId: string | undefined, onUpdate: (data: { equipmentId: string; type: string; startDate: string; endDate: string }) => void) {
  useEffect(() => {
    if (!equipmentId) return
    const s = getSocket()
    if (!s) return

    const handler = (data: { equipmentId: string; type: string; startDate: string; endDate: string }) => {
      if (data.equipmentId === equipmentId) onUpdate(data)
    }

    s.on('availability:updated', handler)
    return () => { s.off('availability:updated', handler) }
  }, [equipmentId, onUpdate])
}

/** Real-time booking chat */
export function useBookingChatSocket(bookingId: string | undefined, onMessage: (msg: unknown) => void) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!bookingId) return
    const s = getSocket()
    if (!s) return

    s.emit('join:booking', bookingId)

    const handler = (msg: unknown) => onMessage(msg)
    s.on('booking:message', handler)

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))

    return () => {
      s.off('booking:message', handler)
    }
  }, [bookingId, onMessage])

  const sendMessage = useCallback((bookingId: string, message: unknown) => {
    const s = getSocket()
    if (s) s.emit('booking:message', { bookingId, message })
  }, [])

  return { connected, sendMessage }
}
