import { useState, useEffect } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const TABS = ['pending', 'approved', 'rejected']

export default function CashInRequests() {
  const [tab, setTab] = useState('pending')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionNote, setActionNote] = useState({})
  const [processing, setProcessing] = useState(null)

  const fetch = async () => {
    setLoading(true)
    try {
      const r = await api.get(`/admin/cashin/requests?status=${tab}`)
      setRequests(r.data.requests)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetch() }, [tab])

  const process = async (id, action) => {
    setProcessing(id)
    try {
      const note = actionNote[id] || ''
      await api.post(`/admin/cashin/${id}/process`, { action, note })
      toast.success(`Request ${action}d!`)
      fetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.')
    } finally { setProcessing(null) }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Cash-In Requests</h1>
      <p className="text-sm text-gray-500">
        Agents submit these when they collect physical cash from users. Approve to credit their digital wallet.
      </p>

      <div className="flex bg-gray-100 rounded-xl p-1 gap-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all
              ${tab === t ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">No {tab} requests</div>
      ) : (
        <div className="space-y-4">
          {requests.map(req => (
            <div key={req.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-extrabold mono text-primary">৳{req.amount}</div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold
                      ${req.status === 'pending' ? 'bg-yellow-100 text-yellow-700'
                      : req.status === 'approved' ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'}`}>
                      {req.status}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-medium">{req.agent_name}</div>
                  <div className="text-xs text-gray-400 mono">{req.agent_phone}</div>
                  {req.reason && <div className="text-sm text-gray-500 mt-1.5">"{req.reason}"</div>}
                  {req.admin_note && (
                    <div className="text-xs mt-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                      Admin note: {req.admin_note}
                    </div>
                  )}
                  <div className="text-xs text-gray-300 mt-2">{new Date(req.created_at).toLocaleString()}</div>
                </div>

                {tab === 'pending' && (
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    <input
                      className="input-field text-sm"
                      placeholder="Admin note (optional)"
                      value={actionNote[req.id] || ''}
                      onChange={e => setActionNote({ ...actionNote, [req.id]: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <button
                        className="flex-1 btn-success text-sm py-2"
                        disabled={processing === req.id}
                        onClick={() => process(req.id, 'approve')}>
                        ✅ Approve
                      </button>
                      <button
                        className="flex-1 btn-danger text-sm py-2"
                        disabled={processing === req.id}
                        onClick={() => process(req.id, 'reject')}>
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
