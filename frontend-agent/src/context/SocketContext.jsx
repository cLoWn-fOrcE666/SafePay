import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import toast from 'react-hot-toast'
import { useAuth } from './AuthContext'

const SocketCtx = createContext(null)

export function SocketProvider({ children }) {
  const { agent, setBalance } = useAuth()
  const socketRef = useRef(null)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem('agent_access_token')
    if (!agent || !token) return

    const socket = io('http://localhost:5000', {
      auth: { token }, transports: ['websocket', 'polling'],
    })
    socket.on('connect', () => socket.emit('join', { token }))
    socket.on('notification', d => {
      setUnread(n => n + 1)
      const fn = d.notif_type === 'success' ? toast.success : d.notif_type === 'danger' ? toast.error : toast
      fn(d.message)
    })
    socket.on('balance_update', d => setBalance(d.balance))
    socketRef.current = socket
    return () => socket.disconnect()
  }, [agent])

  return (
    <SocketCtx.Provider value={{ socket: socketRef.current, unread, clearUnread: () => setUnread(0) }}>
      {children}
    </SocketCtx.Provider>
  )
}

export const useSocket = () => useContext(SocketCtx)
