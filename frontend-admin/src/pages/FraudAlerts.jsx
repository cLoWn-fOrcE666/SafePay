import { useState, useEffect } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const SEVERITY_STYLE = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-orange-100 text-orange-700',
  low:    'bg-yellow-100 text-yellow-700',
}

const RULE_DESC = {
  rapid_fire:    '3+ transactions in 5 minutes',
  large_amount:  'Amount 5× above average',
  unusual_hour:  'Login between 01:00–05:00 BD time',
  fan_out:       'Sent to 5+ people in 10 minutes',
}

export default function FraudAlerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState(null)
  const [showResolved, setShowResolved] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const r = await api.get('/admin/fraud-alerts')
      setAlerts(r.data.alerts)
    } catch {}
    setLoading(false)
  }
  useEffect(() => { fetch() }, [])

  const resolve = async (id) => {
    setResolving(id)
    try {
      await api.post(`/admin/fraud-alerts/${id}/resolve`)
      toast.success('Alert resolved.')
      fetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.')
    } finally { setResolving(null) }
  }

  const filtered = alerts.filter(a => showResolved ? a.is_resolved : !a.is_resolved)
  const unresolvedCount = alerts.filter(a => !a.is_resolved).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Fraud Alerts</h1>
          <p className="text-sm text-gray-500">{unresolvedCount} unresolved alerts</p>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)}
            className="rounded" />
          Show resolved
        </label>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">{showResolved ? '📋' : '✅'}</div>
          {showResolved ? 'No resolved alerts' : 'No active fraud alerts — system is clean!'}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(alert => (
            <div key={alert.id} className={`card border-l-4 ${
              alert.severity === 'high' ? 'border-red-500' :
              alert.severity === 'medium' ? 'border-orange-400' : 'border-yellow-400'
            }`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${SEVERITY_STYLE[alert.severity]}`}>
                      {alert.severity?.toUpperCase()} RISK
                    </span>
                    <span className="font-bold text-sm">{alert.alert_type?.replace('_', ' ').toUpperCase()}</span>
                    {alert.is_resolved && <span className="badge-green">✅ Resolved</span>}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    {RULE_DESC[alert.alert_type] || alert.description}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>👤 {alert.user_name}</span>
                    <span className="mono">{alert.user_phone}</span>
                    <span className="capitalize">({alert.user_type})</span>
                    <span>{new Date(alert.created_at).toLocaleString()}</span>
                  </div>
                </div>
                {!alert.is_resolved && (
                  <button
                    disabled={resolving === alert.id}
                    onClick={() => resolve(alert.id)}
                    className="text-sm bg-green-50 text-green-700 px-4 py-2 rounded-xl font-semibold hover:bg-green-100 transition-all whitespace-nowrap">
                    {resolving === alert.id ? '...' : '✅ Resolve'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
