import { useState, useEffect, useRef } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useSocket } from '../context/SocketContext'

// Even if the server deadline has technically passed by the time the banner
// renders (slow connection / tab was in background), guarantee the guardian
// can still see and press the buttons for at least this many seconds.
const MIN_VISIBLE_SECONDS = 15

export default function GuardianAlertBanner() {
  const { guardianAlert, clearGuardianAlert } = useSocket()

  const [countdown, setCountdown] = useState(60)
  const [expired,   setExpired]   = useState(false)
  const [rejecting, setRejecting] = useState(false)

  // Track when this banner was first mounted so we can enforce the grace period
  const mountedAt = useRef(null)

  useEffect(() => {
    if (!guardianAlert) return

    mountedAt.current = Date.now()
    setExpired(false)
    setRejecting(false)

    const deadline  = new Date(guardianAlert.deadline)
    const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000))
    setCountdown(remaining)

    // Always run the timer — even if remaining is 0 we still count up to
    // MIN_VISIBLE_SECONDS from mount time before showing "expired"
    const iv = setInterval(() => {
      const serverRemaining = Math.max(
        0,
        Math.round((deadline - Date.now()) / 1000),
      )
      const graceRemaining = Math.max(
        0,
        MIN_VISIBLE_SECONDS - Math.round((Date.now() - mountedAt.current) / 1000),
      )
      // Countdown shows the server deadline, but we don't expire until BOTH are 0
      setCountdown(serverRemaining)

      if (serverRemaining === 0 && graceRemaining === 0) {
        clearInterval(iv)
        setExpired(true)
      }
    }, 1000)

    return () => clearInterval(iv)
  }, [guardianAlert])

  if (!guardianAlert) return null

  const handleReject = async () => {
    setRejecting(true)
    try {
      await api.post(`/transactions/${guardianAlert.tx_id}/guardian-reject`)
      toast.error('🚨 Transaction rejected and reported to admin.')
      clearGuardianAlert()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rejection failed.')
      setRejecting(false)
    }
  }

  const handleAllow = () => {
    clearGuardianAlert()
    toast('✅ Transaction allowed. Your ward must confirm with their PIN.')
  }

  // Ring animation
  const TOTAL   = guardianAlert.hold_seconds || 60
  const RADIUS  = 40
  const CIRCUM  = 2 * Math.PI * RADIUS
  const pct     = Math.min(countdown / TOTAL, 1)
  const ringColor = countdown > TOTAL * 0.5 ? '#F59E0B' : '#EF4444'

  const senderName   = guardianAlert.sender_name   || 'Your ward'
  const receiverName = guardianAlert.receiver_name || '—'
  const amount       = parseFloat(guardianAlert.amount || 0)

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* ── Top bar ── */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-5 py-4 text-white text-center">
          <div className="text-2xl font-extrabold tracking-tight">🛡️ Guardian Alert</div>
          <div className="text-sm opacity-90 mt-0.5">Your ward is sending money — act now</div>
        </div>

        <div className="p-5 space-y-4">

          {/* ── Transaction detail card ── */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100">

            {/* Sender row */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center
                text-blue-700 font-extrabold text-lg flex-shrink-0">
                {senderName[0].toUpperCase()}
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                  Ward (Sender)
                </div>
                <div className="font-bold text-gray-800 text-base">{senderName}</div>
              </div>
            </div>

            {/* Arrow + Amount */}
            <div className="flex items-center gap-3 pl-1">
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-0.5 h-2 bg-gray-300 rounded" />
                <span className="text-gray-400 text-sm leading-none">↓</span>
                <div className="w-0.5 h-2 bg-gray-300 rounded" />
              </div>
              <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <div className="text-xs text-red-500 font-bold uppercase tracking-wider mb-1">
                  Amount Being Sent
                </div>
                <div className="text-3xl font-extrabold text-red-600 mono">
                  ৳{amount.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Receiver row */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center
                text-orange-700 font-extrabold text-lg flex-shrink-0">
                {receiverName !== '—' ? receiverName[0].toUpperCase() : '?'}
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                  Receiver
                </div>
                <div className="font-bold text-gray-800 text-base">{receiverName}</div>
              </div>
            </div>
          </div>

          {/* ── Countdown bar ── */}
          <div className="flex items-center gap-4 bg-yellow-50 border border-yellow-200
            rounded-2xl px-4 py-3">
            <div className="relative w-14 h-14 flex-shrink-0">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r={RADIUS} fill="none"
                  stroke="#E5E7EB" strokeWidth="12" />
                <circle cx="48" cy="48" r={RADIUS} fill="none"
                  stroke={ringColor} strokeWidth="12"
                  strokeDasharray={CIRCUM}
                  strokeDashoffset={CIRCUM * (1 - pct)}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg font-extrabold mono
                  ${countdown <= 10 ? 'text-red-600' : 'text-yellow-700'}`}>
                  {countdown}
                </span>
              </div>
            </div>
            <div>
              {expired ? (
                <>
                  <div className="font-semibold text-gray-600 text-sm">Window closed</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Transaction will proceed when ward confirms.
                  </div>
                </>
              ) : (
                <>
                  <div className="font-semibold text-yellow-800 text-sm">
                    {countdown}s left to reject
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Reject to block and report to admin.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── ACTION BUTTONS — always shown while not expired ── */}
          {!expired ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={rejecting}
                onClick={handleReject}
                className="flex flex-col items-center justify-center gap-1.5 bg-red-500
                  hover:bg-red-600 active:scale-95 text-white font-bold py-4 rounded-2xl
                  transition-all shadow-lg shadow-red-200 disabled:opacity-60">
                <span className="text-2xl">🚫</span>
                <span className="text-sm leading-tight">
                  {rejecting ? 'Rejecting...' : 'Reject'}
                </span>
                <span className="text-xs opacity-80 text-center leading-tight">
                  Block & Report
                </span>
              </button>

              <button
                onClick={handleAllow}
                className="flex flex-col items-center justify-center gap-1.5 bg-green-500
                  hover:bg-green-600 active:scale-95 text-white font-bold py-4 rounded-2xl
                  transition-all shadow-lg shadow-green-200">
                <span className="text-2xl">✅</span>
                <span className="text-sm leading-tight">Allow</span>
                <span className="text-xs opacity-80 text-center leading-tight">
                  Let it go through
                </span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleAllow}
              className="w-full border border-gray-200 text-gray-500 font-medium py-3
                rounded-2xl hover:bg-gray-50 transition-all text-sm">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
