import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'

const NAV = [
  { to: '/dashboard',      icon: '📊', label: 'Dashboard' },
  { to: '/users/pending',  icon: '🪪', label: 'User KYC Reviews' },
  { to: '/agents/pending', icon: '⏳', label: 'Agent Approvals' },
  { to: '/cashin',         icon: '📥', label: 'Cash-In Requests' },
  { to: '/users',          icon: '👥', label: 'All Users' },
  { to: '/agents',         icon: '🏪', label: 'All Agents' },
  { to: '/transactions',   icon: '📋', label: 'Transactions' },
  { to: '/fraud',          icon: '🚨', label: 'Fraud Alerts' },
  { to: '/balance',        icon: '⚖️', label: 'Balance Adjust' },
]

export default function Layout({ children }) {
  const { admin, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-blue-50/30">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100
        shadow-lg transform transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>

        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary">SafePay</span>
            <span className="text-xs bg-primary-light text-primary px-2 py-0.5 rounded-full font-semibold">
              Admin
            </span>
          </div>
          <div className="mt-3 bg-gradient-to-r from-primary to-blue-800 rounded-xl p-3 text-white">
            <div className="text-xs opacity-80">System Control Panel</div>
            <div className="text-sm font-bold mt-0.5">{admin?.username}</div>
          </div>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto">
          {NAV.map(({ to, icon, label }) => (
            <Link
              key={to} to={to}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all
                ${location.pathname === to
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'}`}>
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-100">
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="w-full text-sm text-red-500 hover:bg-red-50 py-2 rounded-xl transition-all">
            🚪 Logout
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <main className="flex-1 overflow-auto">
        <header className="lg:hidden bg-white border-b px-4 py-3 flex items-center
          justify-between sticky top-0 z-30">
          <button onClick={() => setOpen(true)} className="text-xl">☰</button>
          <span className="font-bold text-primary">SafePay Admin</span>
          <div />
        </header>
        <div className="p-4 lg:p-6 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
