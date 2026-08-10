import { useState, useEffect, useRef } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useSocket } from '../context/SocketContext'

const STEPS = {
  ENTER:             'enter',
  CONFIRM:           'confirm',
  ANOMALY_HOLD:      'anomaly_hold',
  GUARDIAN_HOLD:     'guardian_hold',
  GUARDIAN_REJECTED: 'guardian_rejected',
  DONE:              'done',
}

export default function SendMoney() {
  const { guardianRejectedTx, clearGuardianRejected } = useSocket()

  const [step,         setStep]         = useState(STEPS.ENTER)
  const [form,         setForm]         = useState({ receiver_phone: '', amount: '', pin: '', note: '' })
  const [receiverInfo, setReceiverInfo] = useState(null)
  const [anomalyData,  setAnomalyData]  = useState(null)
  const [guardianData, setGuardianData] = useState(null)
  const [pendingTxId,  setPendingTxId]  = useState(null)
  const [countdown,    setCountdown]    = useState(0)
  const [holdDone,     setHoldDone]     = useState(false)
  const [lastTx,       setLastTx]       = useState(null)
  const [loading,      setLoading]      = useState(false)
  const pollRef    = useRef(null)
  const countdownRef = useRef(null)

  const set = k => e => setForm({ ...form, [k]: e.target.value })

  // ── Real-time guardian rejection via socket ──────────────────────────────
  useEffect(() => {
    if (!guardianRejectedTx) return
    if (pendingTxId && guardianRejectedTx.tx_id === pendingTxId) {
      stopPolling()
      stopCountdown()
      clearGuardianRejected()
      setStep(STEPS.GUARDIAN_REJECTED)
    }
  }, [guardianRejectedTx, pendingTxId])

  // Cleanup on unmount
  useEffect(() => () => { stopPolling(); stopCountdown() }, [])

  const stopPolling  = () => { if (pollRef.current)     { clearInterval(pollRef.current);     pollRef.current    = null } }
  const stopCountdown = () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null } }

  const startCountdown = (seconds) => {
    stopCountdown()
    setCountdown(seconds)
    setHoldDone(false)
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { stopCountdown(); setHoldDone(true); return 0 }
        return c - 1
      })
    }, 1000)
  }

  // Poll every 4s as a fallback (handles socket disconnects)
  const startPolling = (txId) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const r = await api.get(`/transactions/${txId}/status`)
        if (r.data.status === 'guardian_rejected') {
          stopPolling()
          stopCountdown()
          setStep(STEPS.GUARDIAN_REJECTED)
        }
      } catch { /* ignore */ }
    }, 4000)
  }

  // Step 1 — look up receiver
  const lookupReceiver = async () => {
    if (!form.receiver_phone) return toast.error('Enter a phone number.')
    setLoading(true)
    try {
      const r = await api.post('/transactions/lookup', { phone: form.receiver_phone })
      setReceiverInfo(r.data)
      setStep(STEPS.CONFIRM)
    } catch (err) {
      toast.error(err.response?.data?.error || 'User not found.')
    } finally { setLoading(false) }
  }

  // Step 2 — send
  const sendMoney = async (opts = {}) => {
    if (!form.pin) return toast.error('Enter your PIN.')
    setLoading(true)
    try {
      const r = await api.post('/transactions/send', {
        receiver_phone:    form.receiver_phone,
        amount:            parseFloat(form.amount),
        pin:               form.pin,
        note:              form.note,
        anomaly_confirmed: opts.anomaly_confirmed || false,
      })

      if (r.data.anomaly) {
        setAnomalyData(r.data)
        setStep(STEPS.ANOMALY_HOLD)
        startCountdown(30)

      } else if (r.data.guardian_hold) {
        setGuardianData(r.data)
        setPendingTxId(r.data.transaction_id)
        setStep(STEPS.GUARDIAN_HOLD)
        startCountdown(r.data.hold_seconds || 60)
        startPolling(r.data.transaction_id)

      } else {
        setLastTx(r.data)
        setStep(STEPS.DONE)
        toast.success('Money sent successfully!')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Transfer failed.')
    } finally { setLoading(false) }
  }

  // Step 3 — after hold expires, re-enter PIN to confirm
  const confirmAfterGuardianHold = async () => {
    if (!form.pin) return toast.error('Re-enter your PIN to confirm.')
    setLoading(true)
    try {
      const r = await api.post(`/transactions/${pendingTxId}/guardian-confirm`, { pin: form.pin })
      stopPolling()
      setLastTx(r.data)
      setStep(STEPS.DONE)
      toast.success('Transfer confirmed!')
    } catch (err) {
      const msg = err.response?.data?.error || 'Confirmation failed.'
      if (msg.toLowerCase().includes('reject')) {
        stopPolling()
        setStep(STEPS.GUARDIAN_REJECTED)
      } else {
        toast.error(msg)
      }
    } finally { setLoading(false) }
  }

  const reset = () => {
    stopPolling()
    stopCountdown()
    clearGuardianRejected()
    setStep(STEPS.ENTER)
    setForm({ receiver_phone: '', amount: '', pin: '', note: '' })
    setReceiverInfo(null)
    setAnomalyData(null)
    setGuardianData(null)
    setPendingTxId(null)
    setHoldDone(false)
    setLastTx(null)
  }

  const holdSeconds = guardianData?.hold_seconds || 60

  // ── DONE ─────────────────────────────────────────────────────────────────
  if (step === STEPS.DONE) return (
    <div className="max-w-md mx-auto">
      <div className="card text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold text-primary">Transfer Successful</h2>
        <div className="bg-primary-light rounded-xl p-4">
          <div className="text-3xl font-extrabold text-primary mono">
            ৳{parseFloat(form.amount).toFixed(2)}
          </div>
          <div className="text-sm text-gray-600 mt-1">sent to {receiverInfo?.receiver_name}</div>
          <div className="text-xs text-gray-400 mono">{form.receiver_phone}</div>
        </div>
        {lastTx?.new_balance !== undefined && (
          <div className="text-sm text-gray-500">
            New balance: <span className="font-bold mono text-primary">৳{lastTx.new_balance?.toFixed(2)}</span>
          </div>
        )}
        <button className="btn-primary" onClick={reset}>Send Again</button>
      </div>
    </div>
  )

  // ── GUARDIAN REJECTED ─────────────────────────────────────────────────────
  if (step === STEPS.GUARDIAN_REJECTED) return (
    <div className="max-w-md mx-auto">
      <div className="card text-center space-y-4 border-2 border-red-200 bg-red-50">
        <div className="text-5xl">🚨</div>
        <h2 className="text-xl font-bold text-red-600">Transaction Blocked</h2>
        <p className="text-sm text-gray-600">
          Your guardian rejected the transfer of{' '}
          <span className="font-bold mono text-red-600">
            ৳{parseFloat(form.amount || 0).toFixed(2)}
          </span>{' '}
          to <span className="font-semibold">{receiverInfo?.receiver_name}</span>.
        </p>
        <div className="bg-white border border-red-200 rounded-xl p-3 text-sm text-red-700">
          This transaction has been flagged and reported to the admin as a potential fraud alert.
        </div>
        <button className="btn-primary bg-red-500 hover:bg-red-600" onClick={reset}>
          Back to Send Money
        </button>
      </div>
    </div>
  )

  // ── GUARDIAN HOLD ─────────────────────────────────────────────────────────
  if (step === STEPS.GUARDIAN_HOLD) return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="card border-2 border-yellow-300 bg-yellow-50">
        <div className="text-center space-y-4">
          <div className="text-4xl">🛡️</div>
          <h2 className="text-xl font-bold text-yellow-800">Guardian Notified</h2>
          <p className="text-sm text-gray-600">
            Your guardian{' '}
            <span className="font-semibold mono">{guardianData?.guardian_phone}</span>{' '}
            has been notified. They have{' '}
            <strong>{holdSeconds} seconds</strong> to reject this transaction.
          </p>

          {/* Transaction summary */}
          <div className="bg-white rounded-xl p-4 border border-yellow-200">
            <div className="text-sm text-gray-500">Sending</div>
            <div className="text-2xl font-extrabold mono text-primary">
              ৳{parseFloat(form.amount || 0).toFixed(2)}
            </div>
            <div className="text-sm text-gray-500 mt-0.5">
              to <span className="font-semibold">{receiverInfo?.receiver_name}</span>
            </div>
          </div>

          {!holdDone ? (
            <div className="space-y-2">
              <div className={`text-5xl font-extrabold mono transition-colors
                ${countdown <= 10 ? 'text-red-600' : 'text-yellow-700'}`}>
                {countdown}s
              </div>
              {/* Progress bar uses holdSeconds — not hardcoded */}
              <div className="w-full bg-yellow-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-yellow-500 h-3 rounded-full transition-all duration-1000"
                  style={{ width: `${(countdown / holdSeconds) * 100}%` }}
                />
              </div>
              <div className="text-sm text-gray-500">
                Waiting for guardian window to expire...
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
                ✅ Guardian did not reject. Re-enter your PIN to complete the transfer.
              </div>
              <input
                className="input-field"
                type="password" maxLength={6} placeholder="Re-enter your PIN"
                value={form.pin}
                onChange={e => setForm({ ...form, pin: e.target.value })}
              />
              <button
                className="btn-primary"
                disabled={loading}
                onClick={confirmAfterGuardianHold}>
                {loading ? 'Confirming...' : '✅ Confirm Transfer'}
              </button>
              <button className="btn-outline" onClick={reset}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── ANOMALY HOLD ──────────────────────────────────────────────────────────
  if (step === STEPS.ANOMALY_HOLD) return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="card border-red-200 bg-red-50">
        <div className="text-center space-y-3">
          <div className="text-4xl">🚨</div>
          <h2 className="text-xl font-bold text-red-600">Suspicious Activity Detected</h2>
          <p className="text-sm text-gray-600">{anomalyData?.message}</p>
          <div className="bg-white rounded-xl p-3 text-left space-y-2">
            {anomalyData?.flags?.map(f => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <span className="text-red-500">⚠️</span>
                <span className="capitalize">{f.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
          {countdown > 0 ? (
            <div>
              <div className="text-4xl font-bold text-yellow-600 mono">{countdown}s</div>
              <div className="text-sm text-gray-500">Please wait before confirming</div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">
                Re-enter your PIN to confirm despite the warning:
              </p>
              <input
                className="input-field"
                type="password" placeholder="PIN" maxLength={6}
                value={form.pin}
                onChange={e => setForm({ ...form, pin: e.target.value })}
              />
              <button
                className="btn-primary bg-red-500 hover:bg-red-600"
                disabled={loading}
                onClick={() => sendMoney({ anomaly_confirmed: true })}>
                {loading ? 'Processing...' : 'Confirm Transfer Anyway'}
              </button>
              <button className="btn-outline border-gray-300 text-gray-600" onClick={reset}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── CONFIRM ───────────────────────────────────────────────────────────────
  if (step === STEPS.CONFIRM) return (
    <div className="max-w-md mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Confirm Transfer</h1>
      <div className="card border-2 border-primary/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-light rounded-full flex items-center
            justify-center text-xl font-bold text-primary">
            {receiverInfo?.receiver_name?.[0]}
          </div>
          <div>
            <div className="font-bold">{receiverInfo?.receiver_name}</div>
            <div className="text-sm text-gray-500 mono">{form.receiver_phone}</div>
          </div>
          <div className="ml-auto">
            {receiverInfo?.is_trusted
              ? <span className="badge-green">✅ Trusted</span>
              : <span className="badge-yellow">⚠️ New Contact</span>}
          </div>
        </div>
        {!receiverInfo?.is_trusted && (
          <div className="mt-3 bg-yellow-50 rounded-xl p-3 text-sm text-yellow-800">
            ⚠️ You haven't sent to this contact before. Double-check the number.
          </div>
        )}
        {receiverInfo?.send_count > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            Sent <strong>{receiverInfo.send_count}</strong> time(s) before.
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Amount (৳)</label>
          <input
            className="input-field text-xl font-bold"
            type="number" min="1" placeholder="0.00"
            value={form.amount} onChange={set('amount')}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Note (optional)</label>
          <input className="input-field" placeholder="Add a note..."
            value={form.note} onChange={set('note')} />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Enter PIN</label>
          <input
            className="input-field"
            type="password" placeholder="Your PIN" maxLength={6}
            value={form.pin} onChange={set('pin')}
          />
        </div>
        <button className="btn-primary" disabled={loading} onClick={() => sendMoney()}>
          {loading ? 'Processing...' : `Send ৳${form.amount || '0'} →`}
        </button>
        <button className="btn-outline" onClick={() => setStep(STEPS.ENTER)}>← Back</button>
      </div>
    </div>
  )

  // ── ENTER phone ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Send Money</h1>
      <div className="card space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Receiver Phone Number
          </label>
          <input
            className="input-field"
            type="tel" placeholder="01XXXXXXXXX"
            value={form.receiver_phone} onChange={set('receiver_phone')}
          />
        </div>
        <button className="btn-primary" disabled={loading} onClick={lookupReceiver}>
          {loading ? 'Looking up...' : 'Next →'}
        </button>
      </div>
    </div>
  )
}
