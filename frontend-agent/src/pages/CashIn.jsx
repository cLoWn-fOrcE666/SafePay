import { useState, useEffect } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const STATUS_STYLE = {
  pending: 'badge-yellow',
  approved: 'badge-green',
  rejected: 'badge-red',
}

export default function CashIn() {
  const [form, setForm] = useState({ amount: '', reason: '' })
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('submit')

  const fetchRequests = async () => {
    const r = await api.get('/agent/cashin/requests')
    setRequests(r.data.requests)
  }
  useEffect(() => { fetchRequests() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/agent/cashin/request', { amount: parseFloat(form.amount), reason: form.reason })
      toast.success('Cash-in request submitted to admin!')
      setForm({ amount: '', reason: '' })
      fetchRequests()
      setTab('history')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Cash-In Request</h1>

      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {['submit', 'history'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all
              ${tab === t ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}>
            {t === 'history' ? `My Requests (${requests.length})` : 'Submit Request'}
          </button>
        ))}
      </div>

      {tab === 'submit' && (
        <div className="space-y-4">
          <div className="card bg-emerald-50 border-primary/20">
            <p className="text-sm text-primary font-medium">📤 How Cash-In works:</p>
            <ol className="text-xs text-gray-600 mt-2 space-y-1 list-decimal list-inside">
              <li>You collect physical cash from users</li>
              <li>Submit a request here with the total amount</li>
              <li>Admin reviews and approves</li>
              <li>System credits your agent wallet</li>
              <li>You then send digital money to the users</li>
            </ol>
          </div>
          <div className="card">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Amount Collected (৳)</label>
                <input className="input-field" type="number" min="1" placeholder="0.00"
                  value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Reason / Notes</label>
                <textarea className="input-field resize-none" rows={3} placeholder="Describe the cash collected..."
                  value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
              </div>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Submitting...' : '📤 Submit to Admin'}
              </button>
            </form>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="card text-center text-gray-400 py-10">No requests yet</div>
          ) : requests.map(r => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between">
                <div className="font-bold mono text-primary">৳{r.amount}</div>
                <span className={STATUS_STYLE[r.status] || 'badge-yellow'}>{r.status}</span>
              </div>
              {r.reason && <div className="text-sm text-gray-500 mt-1">"{r.reason}"</div>}
              {r.admin_note && (
                <div className={`text-xs mt-2 p-2 rounded-lg ${r.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                  Admin note: {r.admin_note}
                </div>
              )}
              <div className="text-xs text-gray-400 mt-2">{new Date(r.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
