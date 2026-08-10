import { useState, useEffect } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

function DocImage({ label, url }) {
  const [open, setOpen] = useState(false)
  if (!url) return (
    <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 text-center">
      No {label} uploaded
    </div>
  )
  return (
    <>
      <div>
        <div className="text-xs font-semibold text-gray-500 mb-1">{label}</div>
        <img
          src={url}
          alt={label}
          onClick={() => setOpen(true)}
          className="w-full h-28 object-cover rounded-xl border border-gray-200 cursor-pointer
            hover:opacity-80 transition-opacity"
        />
        <button onClick={() => setOpen(true)} className="text-xs text-primary mt-1">
          🔍 Enlarge
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}>
          <div className="relative max-w-2xl w-full">
            <img src={url} alt={label} className="w-full rounded-2xl shadow-2xl" />
            <button
              className="absolute top-3 right-3 bg-white text-gray-800 rounded-full
                w-8 h-8 flex items-center justify-center font-bold shadow"
              onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default function UserKYCApprovals() {
  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [processing, setProcessing] = useState(null)
  const [reasons,    setReasons]    = useState({})   // { [userId]: string }

  const fetch = async () => {
    setLoading(true)
    try {
      const r = await api.get('/admin/users/pending')
      setUsers(r.data.users)
    } catch { toast.error('Failed to load pending users.') }
    setLoading(false)
  }
  useEffect(() => { fetch() }, [])

  const review = async (userId, action) => {
    if (action === 'reject' && !reasons[userId]?.trim()) {
      return toast.error('Please enter a rejection reason.')
    }
    setProcessing(userId)
    try {
      await api.post(`/admin/users/${userId}/kyc-review`, {
        action,
        reason: reasons[userId] || '',
      })
      toast.success(`User ${action}d.`)
      fetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed.')
    } finally { setProcessing(null) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">User KYC Approvals</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review NID documents and selfies submitted by new users.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : users.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🎉</div>
          No pending user registrations
        </div>
      ) : (
        <div className="space-y-6">
          {users.map(u => (
            <div key={u.id} className="card space-y-4">
              {/* User header */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-12 h-12 bg-primary-light rounded-full flex items-center
                  justify-center text-primary font-bold text-lg">
                  {u.name[0]}
                </div>
                <div>
                  <div className="font-bold text-lg">{u.name}</div>
                  <div className="text-sm text-gray-500 mono">{u.phone}</div>
                  <div className="text-xs text-gray-400">
                    Submitted: {new Date(u.created_at).toLocaleString()}
                  </div>
                </div>
                <span className="ml-auto badge-yellow">⏳ Pending Review</span>
              </div>

              {/* KYC documents */}
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-3">📄 KYC Documents</h3>
                <div className="grid grid-cols-3 gap-3">
                  <DocImage label="NID Front" url={u.nid_front_url} />
                  <DocImage label="NID Back"  url={u.nid_back_url}  />
                  <DocImage label="Selfie"    url={u.selfie_url}    />
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Rejection Reason <span className="text-gray-400">(required only if rejecting)</span>
                  </label>
                  <textarea
                    className="input-field resize-none text-sm"
                    rows={2}
                    placeholder="e.g. NID image is blurry, selfie does not match NID..."
                    value={reasons[u.id] || ''}
                    onChange={e => setReasons({ ...reasons, [u.id]: e.target.value })}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    className="flex-1 btn-success py-2.5"
                    disabled={processing === u.id}
                    onClick={() => review(u.id, 'approve')}>
                    {processing === u.id ? '...' : '✅ Approve'}
                  </button>
                  <button
                    className="flex-1 btn-danger py-2.5"
                    disabled={processing === u.id}
                    onClick={() => review(u.id, 'reject')}>
                    {processing === u.id ? '...' : '❌ Reject'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
