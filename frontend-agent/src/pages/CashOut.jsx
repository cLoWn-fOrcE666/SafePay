import { useState } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

export default function CashOut() {
  const [form, setForm] = useState({ user_phone: '', amount: '', pin: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)
  const set = k => e => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const r = await api.post('/agent/cashout', { ...form, amount: parseFloat(form.amount) })
      setDone(r.data)
      toast.success('Cash-out processed!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.')
    } finally { setLoading(false) }
  }

  if (done) return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="card text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold text-primary">Cash-Out Processed</h2>
        <div className="bg-primary-light rounded-xl p-4">
          <div className="text-3xl font-extrabold text-primary mono">৳{parseFloat(form.amount).toFixed(2)}</div>
          <div className="text-sm text-gray-600 mt-1">sent to {form.user_phone}</div>
        </div>
        <div className="text-sm text-gray-500">Your new balance: <span className="font-bold mono text-primary">৳{done.agent_balance?.toFixed(2)}</span></div>
        <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
          💡 The user will now hand you the physical cash of ৳{parseFloat(form.amount).toFixed(2)}
        </p>
        <button className="btn-primary" onClick={() => { setDone(null); setForm({ user_phone: '', amount: '', pin: '' }) }}>
          Process Another
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-md mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Process Cash-Out</h1>
      <div className="card bg-emerald-50 border-primary/20">
        <p className="text-sm text-primary font-medium">💵 How Cash-Out works:</p>
        <ol className="text-xs text-gray-600 mt-2 space-y-1 list-decimal list-inside">
          <li>User requests cash-out from you</li>
          <li>You send digital money from your agent wallet to user's wallet here</li>
          <li>User's wallet is credited; your wallet is debited</li>
          <li>User hands you the equivalent physical cash</li>
        </ol>
      </div>
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">User's Phone Number</label>
            <input className="input-field" type="tel" placeholder="01XXXXXXXXX"
              value={form.user_phone} onChange={set('user_phone')} required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Amount (৳)</label>
            <input className="input-field" type="number" min="1" placeholder="0.00"
              value={form.amount} onChange={set('amount')} required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Your PIN</label>
            <input className="input-field" type="password" maxLength={6} placeholder="Agent PIN"
              value={form.pin} onChange={set('pin')} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Processing...' : '💵 Process Cash-Out'}
          </button>
        </form>
      </div>
    </div>
  )
}
