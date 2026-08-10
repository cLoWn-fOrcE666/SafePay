import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import toast from 'react-hot-toast'
import { useAuth } from './AuthContext'

const SocketCtx = createContext(null)

export function SocketProvider({ children }) {
  const { user, setBalance } = useAuth()
  const socketRef   = useRef(null)
  const [unread, setUnread]                     = useState(0)
  const [guardianAlert, setGuardianAlert]       = useState(null)
  // Set when backend tells the WARD their guardian just rejected their tx
  const [guardianRejectedTx, setGuardianRejectedTx] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!user || !token) return

    const socket = io('http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => socket.emit('join', { token }))

    socket.on('notification', (data) => {
      setUnread(n => n + 1)
      // Guardian action notifications are shown via the guardianAlert state — skip toast
      if (data.action_type === 'guardian_reject') return
      const icons = { success: '✅', warning: '⚠️', danger: '🚨', info: 'ℹ️' }
      const fn = data.notif_type === 'success' ? toast.success
               : data.notif_type === 'danger'  ? toast.error
               : toast
      fn(`${icons[data.notif_type] || ''} ${data.message}`)
    })

    socket.on('balance_update', (data) => {
      setBalance(data.balance)
    })

    // Guardian gets this event when their ward initiates a large transaction
    socket.on('guardian_alert', (data) => {
      setGuardianAlert(data)
    })

    // Ward gets this event when their guardian rejects the pending transaction
    socket.on('guardian_tx_rejected', (data) => {
      setGuardianRejectedTx(data)
      toast.error(`🚨 Your guardian rejected the transaction. It has been reported to admin.`)
    })

    socketRef.current = socket
    return () => socket.disconnect()
  }, [user])

  const clearUnread          = () => setUnread(0)
  const clearGuardianAlert   = useCallback(() => setGuardianAlert(null), [])
  const clearGuardianRejected = useCallback(() => setGuardianRejectedTx(null), [])

  return (
    <SocketCtx.Provider value={{
      socket: socketRef.current,
      unread,
      clearUnread,
      guardianAlert,
      clearGuardianAlert,
      guardianRejectedTx,
      clearGuardianRejected,
    }}>
      {children}
    </SocketCtx.Provider>
  )
}

export const useSocket = () => useContext(SocketCtx)
