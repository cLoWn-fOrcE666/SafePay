import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useState } from 'react'

const NAV = [
  { to: '/dashboard',     icon: '🏠', label: 'Dashboard' },
  { to: '/cashin',        icon: '📤', label: 'Cash-In Request' },
  { to: '/send',          icon: '💸', label: 'Send to User' },
  { to: '/history',       icon: '📋', label: 'History' },
  { to: '/notifications', icon: '🔔', label: 'Notifications' },
]

export default function Layout({ children }) {
  const { agent, balance, logout } = useAuth()
  const { unread, clearUnread } = useSocket()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-emerald-50/30">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100
        shadow-lg transform transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>

        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary">SafePay</span>
            <span className="text-xs bg-primary-light text-primary-dark px-2 py-0.5 rounded-full">
              Agent
            </span>
          </div>
          <div className="mt-3 bg-gradient-to-r from-primary to-emerald-800 rounded-xl p-3 text-white">
            <div className="text-xs opacity-80">Agent Balance</div>
            <div className="text-xl font-bold mono">৳{balance?.toFixed(2) || '0.00'}</div>
            <div className="text-xs opacity-70 mt-0.5">
              {agent?.business_name || agent?.name}
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {NAV.map(({ to, icon, label }) => (
            <Link
              key={to} to={to}
              onClick={() => {
                setOpen(false)
                if (to === '/notifications') clearUnread()
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all
                ${location.pathname === to
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'}`}>
              <span>{icon}</span>
              <span>{label}</span>
              {label === 'Notifications' && unread > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {unread}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center
              text-primary font-bold text-sm">
              {agent?.name?.[0]}
            </div>
            <div>
              <div className="text-sm font-semibold">{agent?.name}</div>
              <div className="text-xs text-gray-400">{agent?.phone}</div>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="w-full text-sm text-red-500 hover:bg-red-50 py-2 rounded-xl transition-all">
            🚪 Logout
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <main className="flex-1 overflow-auto">
        <header className="lg:hidden bg-white border-b px-4 py-3 flex items-center
          justify-between sticky top-0 z-30">
          <button onClick={() => setOpen(true)} className="text-xl">☰</button>
          <span className="font-bold text-primary">SafePay Agent</span>
          <span className="mono text-sm font-semibold text-primary">
            ৳{balance?.toFixed(2)}
          </span>
        </header>

        <div className="p-4 lg:p-6 max-w-4xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
