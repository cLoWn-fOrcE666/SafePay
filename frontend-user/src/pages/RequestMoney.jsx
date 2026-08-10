import { useState, useEffect } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

export default function RequestMoney() {
  const [tab, setTab] = useState('send')
  const [form, setForm] = useState({ target_phone: '', amount: '', note: '' })
  const [incoming, setIncoming] = useState([])
  const [loading, setLoading] = useState(false)
  const [respondPin, setRespondPin] = useState({})

  const set = k => e => setForm({ ...form, [k]: e.target.value })

  const fetchIncoming = async () => {
    try {
      const r = await api.get('/transactions/requests/incoming')
      setIncoming(r.data.requests)
    } catch {}
  }

  useEffect(() => { fetchIncoming() }, [])

  const sendRequest = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/transactions/request', form)
      toast.success('Money request sent!')
      setForm({ target_phone: '', amount: '', note: '' })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Request failed.')
    } finally { setLoading(false) }
  }

  const respond = async (reqId, action) => {
    const pin = respondPin[reqId]
    if (!pin) return toast.error('Enter your PIN.')
    setLoading(true)
    try {
      await api.post(`/transactions/requests/${reqId}/respond`, { action, pin })
      toast.success(action === 'accept' ? 'Money sent!' : 'Request rejected.')
      fetchIncoming()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Money Requests</h1>

      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {['send', 'incoming'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all
              ${tab === t ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}>
            {t === 'incoming' ? `Incoming (${incoming.length})` : 'Send Request'}
          </button>
        ))}
      </div>

      {tab === 'send' && (
        <div className="card">
          <h2 className="font-bold mb-4">Request Money From Someone</h2>
          <form onSubmit={sendRequest} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Their Phone Number</label>
              <input className="input-field" type="tel" placeholder="01XXXXXXXXX"
                value={form.target_phone} onChange={set('target_phone')} required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Amount (৳)</label>
              <input className="input-field" type="number" min="1" placeholder="0.00"
                value={form.amount} onChange={set('amount')} required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Note</label>
              <input className="input-field" placeholder="Reason for request"
                value={form.note} onChange={set('note')} />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Sending...' : 'Send Request'}
            </button>
          </form>
        </div>
      )}

      {tab === 'incoming' && (
        <div className="space-y-4">
          {incoming.length === 0 ? (
            <div className="card text-center text-gray-400 py-10">No incoming requests</div>
          ) : incoming.map(req => (
            <div key={req.id} className="card border-l-4 border-yellow-400 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold">{req.requester_name}</div>
                  <div className="text-sm text-gray-500">is requesting <span className="font-bold text-primary mono">৳{req.amount}</span></div>
                  {req.note && <div className="text-xs text-gray-400 mt-1">"{req.note}"</div>}
                  <div className="text-xs text-gray-300 mt-1">{new Date(req.created_at).toLocaleString()}</div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Enter your PIN to respond</label>
                <input className="input-field text-sm" type="password" placeholder="PIN" maxLength={6}
                  value={respondPin[req.id] || ''}
                  onChange={e => setRespondPin({ ...respondPin, [req.id]: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <button className="flex-1 bg-primary text-white rounded-xl py-2 text-sm font-semibold hover:bg-primary-dark"
                  disabled={loading} onClick={() => respond(req.id, 'accept')}>
                  ✅ Accept & Send
                </button>
                <button className="flex-1 border border-red-300 text-red-500 rounded-xl py-2 text-sm font-semibold hover:bg-red-50"
                  disabled={loading} onClick={() => respond(req.id, 'reject')}>
                  ❌ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
