import { useState } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

export default function SendToUser() {
  const [form, setForm] = useState({ user_phone: '', amount: '', pin: '', note: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)
  const set = k => e => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const r = await api.post('/agent/send', { ...form, amount: parseFloat(form.amount) })
      setDone(r.data)
      toast.success('Sent successfully!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.')
    } finally { setLoading(false) }
  }

  if (done) return (
    <div className="max-w-md mx-auto">
      <div className="card text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold text-primary">Transfer Successful</h2>
        <div className="bg-primary-light rounded-xl p-4">
          <div className="text-3xl font-extrabold text-primary mono">৳{parseFloat(form.amount).toFixed(2)}</div>
          <div className="text-sm text-gray-500 mt-1">sent to {form.user_phone}</div>
        </div>
        <div className="text-sm text-gray-500">Your balance: <span className="font-bold mono text-primary">৳{done.agent_balance?.toFixed(2)}</span></div>
        <button className="btn-primary" onClick={() => { setDone(null); setForm({ user_phone: '', amount: '', pin: '', note: '' }) }}>
          Send Again
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-md mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Send to User</h1>
      <div className="card space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">User Phone Number</label>
            <input className="input-field" type="tel" placeholder="01XXXXXXXXX"
              value={form.user_phone} onChange={set('user_phone')} required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Amount (৳)</label>
            <input className="input-field" type="number" min="1" placeholder="0.00"
              value={form.amount} onChange={set('amount')} required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Note (optional)</label>
            <input className="input-field" placeholder="Add a note..."
              value={form.note} onChange={set('note')} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Your PIN</label>
            <input className="input-field" type="password" maxLength={6} placeholder="Agent PIN"
              value={form.pin} onChange={set('pin')} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Sending...' : '💸 Send'}
          </button>
        </form>
      </div>
    </div>
  )
}
