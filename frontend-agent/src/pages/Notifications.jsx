import { useState, useEffect } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const ICONS = { success: '✅', warning: '⚠️', danger: '🚨', info: 'ℹ️' }
const BG = { success: 'bg-green-50 border-green-200', warning: 'bg-yellow-50 border-yellow-200',
             danger: 'bg-red-50 border-red-200', info: 'bg-blue-50 border-blue-200' }

export default function Notifications() {
  const [notifs, setNotifs] = useState([])
  const [unread, setUnread] = useState(0)

  const fetch = async () => {
    const r = await api.get('/notifications/')
    setNotifs(r.data.notifications)
    setUnread(r.data.unread)
  }
  useEffect(() => { fetch() }, [])

  const markAllRead = async () => {
    await api.post('/notifications/read-all')
    fetch()
    toast.success('All marked as read.')
  }

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`)
    setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: true } : x))
    setUnread(u => Math.max(0, u - 1))
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <div className="flex items-center gap-3">
          {unread > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{unread} unread</span>}
          <button onClick={markAllRead} className="text-xs text-primary font-semibold">Mark All Read</button>
        </div>
      </div>

      {notifs.length === 0 ? (
        <div className="card text-center text-gray-400 py-12">No notifications yet 🔔</div>
      ) : notifs.map(n => (
        <div key={n.id} onClick={() => !n.is_read && markRead(n.id)}
          className={`card border cursor-pointer transition-all ${BG[n.notif_type] || BG.info} ${!n.is_read ? 'shadow-md' : 'opacity-70'}`}>
          <div className="flex items-start gap-3">
            <span className="text-xl">{ICONS[n.notif_type]}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">{n.title}</div>
                {!n.is_read && <div className="w-2 h-2 bg-primary rounded-full"></div>}
              </div>
              <div className="text-sm text-gray-600 mt-0.5">{n.message}</div>
              <div className="text-xs text-gray-400 mt-1.5">{new Date(n.created_at).toLocaleString()}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
