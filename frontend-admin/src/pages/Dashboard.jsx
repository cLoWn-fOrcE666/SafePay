import { useEffect, useState } from 'react'
import api from '../api/axios'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="text-center py-20 text-primary">Loading system stats...</div>
  )

  const statCards = [
    { label: 'Approved Users',     value: stats?.total_approved_users,     icon: '👥', color: 'bg-blue-50 text-primary' },
    { label: 'Total Agents',       value: stats?.total_agents,             icon: '🏪', color: 'bg-indigo-50 text-indigo-700' },
    { label: 'Frozen Accounts',    value: stats?.frozen_users,             icon: '🔒', color: 'bg-red-50 text-red-600' },
    { label: 'Fraud Alerts',       value: stats?.unresolved_fraud_alerts,  icon: '🚨', color: 'bg-orange-50 text-orange-600' },
    { label: "Today's Volume",     value: `৳${stats?.today_volume?.toFixed(0) || 0}`,  icon: '📈', color: 'bg-green-50 text-green-700' },
    { label: 'Weekly Volume',      value: `৳${stats?.week_volume?.toFixed(0) || 0}`,   icon: '📊', color: 'bg-teal-50 text-teal-700' },
    { label: 'Monthly Volume',     value: `৳${stats?.month_volume?.toFixed(0) || 0}`,  icon: '💰', color: 'bg-cyan-50 text-cyan-700' },
    { label: 'Total in System',    value: `৳${stats?.total_money_in_system?.toFixed(0) || 0}`, icon: '🏦', color: 'bg-primary-light text-primary' },
  ]

  // Pending actions — anything > 0 gets a banner
  const pendingActions = [
    {
      label: 'Pending User KYC Reviews',
      value: stats?.pending_user_approvals,
      icon: '🪪',
      path: '/users/pending',
      color: 'border-purple-300 bg-purple-50',
    },
    {
      label: 'Pending Agent Approvals',
      value: stats?.pending_agent_approvals,
      icon: '⏳',
      path: '/agents/pending',
      color: 'border-blue-300 bg-blue-50',
    },
    {
      label: 'Pending Cash-In Requests',
      value: stats?.pending_cashin_requests,
      icon: '📥',
      path: '/cashin',
      color: 'border-yellow-300 bg-yellow-50',
    },
  ]

  const activePending = pendingActions.filter(p => p.value > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Dashboard</h1>
        <p className="text-gray-500 text-sm">SafePay Admin Control Panel</p>
      </div>

      {/* Pending action banners */}
      {activePending.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activePending.map(p => (
            <a
              key={p.label} href={p.path}
              className={`card border-2 ${p.color} flex items-center justify-between
                hover:shadow-md transition-all cursor-pointer`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.icon}</span>
                <div>
                  <div className="font-bold text-sm">{p.label}</div>
                  <div className="text-xs text-gray-500">Requires your action</div>
                </div>
              </div>
              <div className="text-3xl font-extrabold text-primary">{p.value}</div>
            </a>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className={`card ${s.color}`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-extrabold mono">{s.value}</div>
            <div className="text-xs mt-1 opacity-80 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Volume chart */}
      {stats?.daily_volume && (
        <div className="card">
          <h3 className="font-bold mb-4">7-Day Transaction Volume</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.daily_volume}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => [`৳${v}`, 'Volume']} />
              <Bar dataKey="volume" fill="#1D4ED8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
