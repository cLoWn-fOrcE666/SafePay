import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

export default function Dashboard() {
  const { agent, balance } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/agent/dashboard').then(r => setData(r.data)).catch(() => {})
  }, [])

  const stats = [
    {
      label: "Today's Cash-Outs Received",
      value: `৳${data?.today_cashouts?.toFixed(0) || 0}`,
      icon: '💵',
      color: 'bg-emerald-50 text-primary',
    },
    {
      label: 'Total Cash-Outs Received',
      value: `৳${data?.total_cashouts?.toFixed(0) || 0}`,
      icon: '💰',
      color: 'bg-teal-50 text-teal-700',
    },
    {
      label: 'Pending Cash-In',
      value: data?.pending_cashin || 0,
      icon: '⏳',
      color: 'bg-yellow-50 text-yellow-700',
    },
  ]

  const quick = [
    { icon: '📤', label: 'Cash-In Request', to: '/cashin', color: 'from-teal-500 to-teal-700' },
    { icon: '💸', label: 'Send to User',    to: '/send',   color: 'from-primary to-emerald-700' },
    { icon: '📋', label: 'History',         to: '/history',color: 'from-emerald-700 to-green-900' },
    { icon: '🔔', label: 'Notifications',   to: '/notifications', color: 'from-green-600 to-green-800' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {agent?.name?.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 text-sm">{agent?.business_name}</p>
      </div>

      {/* Balance card */}
      <div className="bg-gradient-to-r from-primary to-emerald-800 rounded-2xl p-6 text-white shadow-lg">
        <div className="text-sm opacity-80">Agent Balance</div>
        <div className="text-4xl font-extrabold mono mt-1">
          ৳{balance?.toFixed(2) || '0.00'}
        </div>
        <div className="text-sm opacity-70 mt-2">{agent?.phone}</div>
      </div>

      {/* Cash-out info banner */}
      <div className="card bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-700">
          <span className="font-semibold">💡 Cash-Out flow reminder:</span> Users initiate
          cash-outs from their own portal. When a user sends digital money to your wallet,
          hand them the equivalent physical cash.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3">
        {quick.map(q => (
          <button
            key={q.label}
            onClick={() => navigate(q.to)}
            className={`bg-gradient-to-br ${q.color} text-white rounded-2xl p-4 flex flex-col
              items-center gap-2 hover:opacity-90 transition-all shadow-sm`}>
            <span className="text-2xl">{q.icon}</span>
            <span className="text-xs font-semibold text-center leading-tight">{q.label}</span>
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`card ${s.color} text-center`}>
            <div className="text-2xl">{s.icon}</div>
            <div className="text-xl font-bold mono mt-1">{s.value}</div>
            <div className="text-xs mt-1 opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent transactions */}
      <div className="card">
        <h3 className="font-bold mb-4">Recent Transactions</h3>
        {!data?.recent_transactions?.length ? (
          <div className="text-center text-gray-400 py-6 text-sm">No transactions yet</div>
        ) : (
          data.recent_transactions.map(tx => (
            <div
              key={tx.id}
              className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div>
                <div className="text-sm font-medium capitalize">
                  {tx.tx_type === 'cash_out' ? '💵 Cash-Out Received' : tx.tx_type.replace('_', '-')}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(tx.created_at).toLocaleString()}
                </div>
              </div>
              <div className={`font-bold mono text-sm
                ${tx.sender_type === 'agent' && tx.sender_id === agent?.id
                  ? 'text-red-500'
                  : 'text-primary'}`}>
                ৳{tx.amount}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
