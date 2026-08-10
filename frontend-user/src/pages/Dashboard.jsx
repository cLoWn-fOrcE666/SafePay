import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

export default function Dashboard() {
  const { user, balance } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [incomingReqs, setIncomingReqs] = useState([])
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/transactions/stats'),
      api.get('/transactions/history?per_page=5'),
      api.get('/transactions/requests/incoming'),
    ]).then(([s, h, r]) => {
      setStats(s.data)
      setHistory(h.data.transactions)
      setIncomingReqs(r.data.requests)
    }).catch(() => {}).finally(() => setLoadingStats(false))
  }, [])

  const quickActions = [
    { icon: '💸', label: 'Send',     to: '/send',    color: 'bg-primary' },
    { icon: '💵', label: 'Cash Out', to: '/cashout', color: 'bg-emerald-600' },
    { icon: '📥', label: 'Request',  to: '/request', color: 'bg-emerald-700' },
    { icon: '📋', label: 'History',  to: '/history', color: 'bg-teal-600' },
  ]

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 text-sm">
          {new Date().toLocaleDateString('en-BD', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-primary to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="text-sm opacity-80">Available Balance</div>
        <div className="text-4xl font-extrabold mono mt-1">
          ৳{balance?.toFixed(2) || '0.00'}
        </div>
        <div className="text-sm opacity-70 mt-2">{user?.phone} · SafePay Wallet</div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
        {quickActions.map(a => (
          <button
            key={a.label}
            onClick={() => navigate(a.to)}
            className={`${a.color} text-white rounded-2xl p-4 flex flex-col items-center gap-2
              shadow-sm hover:opacity-90 transition-all`}>
            <span className="text-2xl">{a.icon}</span>
            <span className="text-xs font-semibold">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Incoming Money Requests banner */}
      {incomingReqs.length > 0 && (
        <div className="card border-warn bg-warn-light/50">
          <h3 className="font-bold text-sm mb-3 text-warn">
            ⚠️ Pending Money Requests ({incomingReqs.length})
          </h3>
          {incomingReqs.slice(0, 3).map(r => (
            <div
              key={r.id}
              className="flex items-center justify-between py-2 border-b border-warn/20 last:border-0">
              <div>
                <div className="font-medium text-sm">{r.requester_name}</div>
                <div className="text-xs text-gray-500">৳{r.amount} · {r.note}</div>
              </div>
              <button
                onClick={() => navigate('/request')}
                className="text-xs bg-warn text-white px-3 py-1 rounded-lg">
                View
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Week / Month stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center">
            <div className="text-xs text-gray-500">This Week</div>
            <div className="text-xl font-bold text-primary mono">
              ৳{stats.week_total?.toFixed(0)}
            </div>
            <div className="text-xs text-gray-400">sent</div>
          </div>
          <div className="card text-center">
            <div className="text-xs text-gray-500">This Month</div>
            <div className="text-xl font-bold text-primary mono">
              ৳{stats.month_total?.toFixed(0)}
            </div>
            <div className="text-xs text-gray-400">sent</div>
          </div>
        </div>
      )}

      {/* 7-Day spending trend */}
      {stats?.daily_trend && (
        <div className="card">
          <h3 className="font-bold mb-4">7-Day Spending Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={stats.daily_trend}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => [`৳${v}`, 'Sent']} />
              <Line
                type="monotone" dataKey="amount"
                stroke="#10B981" strokeWidth={2.5} dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Recipients */}
      {stats?.top_receivers?.length > 0 && (
        <div className="card">
          <h3 className="font-bold mb-3">Top Recipients (This Month)</h3>
          {stats.top_receivers.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center
                  text-primary font-bold text-sm">
                  {r.name[0]}
                </div>
                <div>
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-gray-400 mono">{r.phone}</div>
                </div>
              </div>
              <div className="text-sm font-bold text-primary mono">৳{r.total?.toFixed(0)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Transactions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Recent Transactions</h3>
          <button onClick={() => navigate('/history')} className="text-xs text-primary font-semibold">
            View All
          </button>
        </div>
        {history.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">No transactions yet</div>
        ) : (
          history.map(tx => (
            <div
              key={tx.id}
              className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg
                  ${tx.direction === 'out' ? 'bg-red-50' : 'bg-primary-light'}`}>
                  {tx.direction === 'out' ? '↗' : '↙'}
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {tx.direction === 'out'
                      ? (tx.tx_type === 'cash_out'
                          ? `Cash-Out → ${tx.receiver_name}`
                          : `To ${tx.receiver_name}`)
                      : `From ${tx.sender_name}`}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className={`font-bold mono text-sm
                ${tx.direction === 'out' ? 'text-red-500' : 'text-primary'}`}>
                {tx.direction === 'out' ? '-' : '+'}৳{tx.amount}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
