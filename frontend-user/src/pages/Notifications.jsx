import { useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const ICONS = { success: '✅', warning: '⚠️', danger: '🚨', info: 'ℹ️' }
const BG    = {
  success: 'bg-green-50 border-green-200',
  warning: 'bg-yellow-50 border-yellow-200',
  danger:  'bg-red-50 border-red-200',
  info:    'bg-blue-50 border-blue-200',
}

// ── Guardian Action Card ────────────────────────────────────────────────────
function GuardianActionCard({ notif, onDone }) {
  let payload = null
  try { payload = JSON.parse(notif.action_data) } catch {}

  const [rejecting,  setRejecting]  = useState(false)
  const [rejected,   setRejected]   = useState(false)
  const [allowed,    setAllowed]    = useState(false)
  const [countdown,  setCountdown]  = useState(null)
  const [isExpired,  setIsExpired]  = useState(false)

  // Live countdown — purely informational, does NOT hide buttons
  useEffect(() => {
    if (!payload?.deadline) return
    const tick = () => {
      const remaining = Math.round((new Date(payload.deadline) - Date.now()) / 1000)
      if (remaining <= 0) {
        setCountdown(0)
        setIsExpired(true)
      } else {
        setCountdown(remaining)
      }
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [payload?.deadline])

  const handleReject = async () => {
    if (!payload?.tx_id) return
    setRejecting(true)
    try {
      await api.post(`/transactions/${payload.tx_id}/guardian-reject`)
      toast.error('🚨 Transaction rejected and reported to admin.')
      setRejected(true)
      onDone()
    } catch (err) {
      const msg = err.response?.data?.error || 'Rejection failed.'
      toast.error(msg)
      // Even on error, mark as handled so they don't keep retrying
      if (msg.toLowerCase().includes('no longer pending') ||
          msg.toLowerCase().includes('not pending')) {
        setRejected(true)
      }
    } finally {
      setRejecting(false)
    }
  }

  const handleAllow = () => {
    setAllowed(true)
    toast('✅ Transaction allowed. Your ward will confirm with their PIN.')
    onDone()
  }

  // ── Already handled ───────────────────────────────────────────────────────
  if (rejected) return (
    <div className="card border border-red-200 bg-red-50 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xl">🚨</span>
        <div>
          <div className="font-bold text-red-700 text-sm">Transaction Rejected</div>
          <div className="text-xs text-gray-400">{new Date(notif.created_at).toLocaleString()}</div>
        </div>
      </div>
      {payload && (
        <div className="text-sm text-gray-600 bg-white rounded-xl p-3">
          You rejected <span className="font-bold text-red-600 mono">৳{parseFloat(payload.amount || 0).toFixed(2)}</span> from{' '}
          <span className="font-semibold">{payload.sender}</span> to{' '}
          <span className="font-semibold">{payload.receiver}</span>. Admin has been notified.
        </div>
      )}
    </div>
  )

  if (allowed) return (
    <div className="card border border-green-200 bg-green-50 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xl">✅</span>
        <div>
          <div className="font-bold text-green-700 text-sm">Transaction Allowed</div>
          <div className="text-xs text-gray-400">{new Date(notif.created_at).toLocaleString()}</div>
        </div>
      </div>
    </div>
  )

  // ── Active guardian card ───────────────────────────────────────────────────
  return (
    <div className="card border-2 border-orange-300 bg-orange-50 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🛡️</span>
          <div>
            <div className="font-bold text-orange-800 text-base">Guardian Alert — Action Required</div>
            <div className="text-xs text-gray-400">{new Date(notif.created_at).toLocaleString()}</div>
          </div>
        </div>
        {!notif.is_read && (
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full mt-1 flex-shrink-0" />
        )}
      </div>

      {/* Transaction detail */}
      {payload && (
        <div className="bg-white rounded-2xl border border-orange-200 overflow-hidden">
          {/* Sender */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-orange-100">
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center
              text-blue-700 font-bold text-base flex-shrink-0">
              {(payload.sender || 'W')[0].toUpperCase()}
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Ward (Sender)</div>
              <div className="font-bold text-gray-800">{payload.sender || 'Unknown'}</div>
            </div>
          </div>

          {/* Amount */}
          <div className="bg-red-50 px-4 py-3 text-center border-b border-orange-100">
            <div className="text-xs text-red-500 font-bold uppercase tracking-wider mb-0.5">Amount Being Sent</div>
            <div className="text-3xl font-extrabold text-red-600 mono">
              ৳{parseFloat(payload.amount || 0).toFixed(2)}
            </div>
          </div>

          {/* Receiver */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center
              text-orange-700 font-bold text-base flex-shrink-0">
              {(payload.receiver || 'R')[0].toUpperCase()}
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Receiver</div>
              <div className="font-bold text-gray-800">{payload.receiver || 'Unknown'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Timer — informational only, never hides the buttons */}
      <div className={`flex items-center gap-3 rounded-xl px-4 py-3
        ${isExpired ? 'bg-gray-100 border border-gray-200' : 'bg-yellow-100 border border-yellow-200'}`}>
        <span className="text-2xl">{isExpired ? '⏰' : '⏱️'}</span>
        <div>
          {isExpired ? (
            <>
              <div className="font-semibold text-gray-600 text-sm">Window has expired</div>
              <div className="text-xs text-gray-400 mt-0.5">
                You can still reject below — the backend will block it if still pending.
              </div>
            </>
          ) : (
            <>
              <div className="font-bold text-yellow-800 text-lg mono">{countdown}s remaining</div>
              <div className="text-xs text-gray-500 mt-0.5">Reject before the timer runs out to block this transaction.</div>
            </>
          )}
        </div>
      </div>

      {/* Action buttons — ALWAYS visible */}
      <div className="grid grid-cols-2 gap-3">
        <button
          disabled={rejecting}
          onClick={handleReject}
          className="flex flex-col items-center justify-center gap-1.5 bg-red-500
            hover:bg-red-600 active:scale-95 text-white font-bold py-4 rounded-2xl
            transition-all shadow-md shadow-red-200 disabled:opacity-60">
          <span className="text-2xl">🚫</span>
          <span className="text-sm">{rejecting ? 'Rejecting...' : 'Reject'}</span>
          <span className="text-xs opacity-80">Block &amp; Report Admin</span>
        </button>

        <button
          onClick={handleAllow}
          className="flex flex-col items-center justify-center gap-1.5 bg-green-500
            hover:bg-green-600 active:scale-95 text-white font-bold py-4 rounded-2xl
            transition-all shadow-md shadow-green-200">
          <span className="text-2xl">✅</span>
          <span className="text-sm">Allow</span>
          <span className="text-xs opacity-80">Let it go through</span>
        </button>
      </div>

    </div>
  )
}

// ── Main Notifications Page ─────────────────────────────────────────────────
export default function Notifications() {
  const [notifs, setNotifs] = useState([])
  const [unread, setUnread] = useState(0)

  const fetch = useCallback(async () => {
    try {
      const r = await api.get('/notifications/')
      setNotifs(r.data.notifications)
      setUnread(r.data.unread)
    } catch {}
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const markAllRead = async () => {
    await api.post('/notifications/read-all')
    fetch()
    toast.success('All marked as read.')
  }

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`)
      setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: true } : x))
      setUnread(u => Math.max(0, u - 1))
    } catch {}
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
              {unread} unread
            </span>
          )}
          <button onClick={markAllRead} className="text-xs text-primary font-semibold">
            Mark All Read
          </button>
        </div>
      </div>

      {notifs.length === 0 ? (
        <div className="card text-center text-gray-400 py-12">No notifications yet 🔔</div>
      ) : (
        notifs.map(n => {
          // Guardian action notifications get the interactive card
          if (n.action_type === 'guardian_reject') {
            return (
              <GuardianActionCard
                key={n.id}
                notif={n}
                onDone={() => {
                  markRead(n.id)
                  fetch()
                }}
              />
            )
          }

          // Standard notification
          return (
            <div
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              className={`card border cursor-pointer transition-all
                ${BG[n.notif_type] || BG.info}
                ${!n.is_read ? 'shadow-md' : 'opacity-70'}`}>
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{ICONS[n.notif_type] || 'ℹ️'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm">{n.title}</div>
                    {!n.is_read && <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                  </div>
                  <div className="text-sm text-gray-600 mt-0.5">{n.message}</div>
                  <div className="text-xs text-gray-400 mt-1.5">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
