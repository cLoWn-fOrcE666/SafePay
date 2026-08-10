import { useState, useEffect } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

export default function BalanceAdjust() {
  const [users, setUsers] = useState([])
  const [agents, setAgents] = useState([])
  const [form, setForm] = useState({ owner_id: '', owner_type: 'user', action: 'credit', amount: '', reason: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    api.get('/admin/users').then(r => setUsers(r.data.users)).catch(() => {})
    api.get('/admin/agents').then(r => setAgents(r.data.agents)).catch(() => {})
  }, [])

  const set = k => e => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.owner_id) return toast.error('Select an account.')
    if (!confirm(`⚠️ Are you sure you want to ${form.action} ৳${form.amount} ${form.action === 'credit' ? 'to' : 'from'} this account?`)) return
    setLoading(true)
    setResult(null)
    try {
      const r = await api.post('/admin/balance/adjust', {
        owner_id: parseInt(form.owner_id),
        owner_type: form.owner_type,
        action: form.action,
        amount: parseFloat(form.amount),
        reason: form.reason,
      })
      toast.success('Balance adjusted!')
      setResult(r.data)
      setForm({ owner_id: '', owner_type: 'user', action: 'credit', amount: '', reason: '' })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.')
    } finally { setLoading(false) }
  }

  const currentList = form.owner_type === 'user' ? users : agents

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Emergency Balance Adjustment</h1>
        <p className="text-sm text-gray-500 mt-1">
          ⚠️ Use with extreme caution. This directly modifies wallet balances and is logged.
        </p>
      </div>

      <div className="card border-2 border-yellow-300 bg-yellow-50">
        <div className="font-semibold text-yellow-800 mb-1">⚠️ Admin Override</div>
        <p className="text-xs text-yellow-700">
          This tool bypasses normal transaction flow. Only use for genuine errors or emergencies.
          All adjustments are recorded and visible in the audit trail.
        </p>
      </div>

      {result && (
        <div className="card border-green-300 bg-green-50">
          <div className="font-semibold text-green-700">✅ Adjustment Successful</div>
          <div className="text-sm text-gray-600 mt-1">
            New balance: <span className="font-bold mono text-primary">৳{result.new_balance?.toFixed(2)}</span>
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Account Type</label>
              <select className="input-field" value={form.owner_type} onChange={e => setForm({ ...form, owner_type: e.target.value, owner_id: '' })}>
                <option value="user">User</option>
                <option value="agent">Agent</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Action</label>
              <select className="input-field" value={form.action} onChange={set('action')}>
                <option value="credit">➕ Credit (Add money)</option>
                <option value="debit">➖ Debit (Remove money)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Select Account</label>
            <select className="input-field" value={form.owner_id} onChange={set('owner_id')} required>
              <option value="">-- Select {form.owner_type} --</option>
              {currentList.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.phone}) — ৳{u.balance?.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Amount (৳)</label>
            <input className="input-field" type="number" min="1" step="0.01" placeholder="0.00"
              value={form.amount} onChange={set('amount')} required />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Reason (required)</label>
            <textarea className="input-field resize-none" rows={3}
              placeholder="Explain why this adjustment is necessary..."
              value={form.reason} onChange={set('reason')} required />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Processing...' : `⚖️ Apply ${form.action === 'credit' ? 'Credit' : 'Debit'}`}
          </button>
        </form>
      </div>
    </div>
  )
}
