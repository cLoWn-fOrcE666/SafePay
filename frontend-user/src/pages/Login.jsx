import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import api from '../api/axios'

const STEPS = { PIN: 'pin', OTP: 'otp', NEW_LOCATION: 'new_location' }

export default function Login() {
  const { loginStep1, loginStep2, resendOtp, loginAlert, clearLoginAlert } = useAuth()
  const navigate = useNavigate()

  const [step,       setStep]       = useState(STEPS.PIN)
  const [pinForm,    setPinForm]    = useState({ phone: '', pin: '' })
  const [otp,        setOtp]        = useState('')
  const [pendingId,  setPendingId]  = useState(null)   // user_id from step 1
  const [devOtp,     setDevOtp]     = useState(null)   // shown in dev mode
  const [hasEmail,   setHasEmail]   = useState(false)
  const [resending,  setResending]  = useState(false)
  const [countdown,  setCountdown]  = useState(0)
  const [loading,    setLoading]    = useState(false)

  // ── Step 1: verify phone + PIN ────────────────────────────────────────────
  const handlePinSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await loginStep1(pinForm.phone, pinForm.pin)
      // res = { otp_required, user_id, dev_mode, dev_otp?, has_email, message }
      setPendingId(res.user_id)
      setHasEmail(res.has_email)
      if (res.dev_otp) setDevOtp(res.dev_otp)
      setStep(STEPS.OTP)
      toast.success(res.message)
    } catch (err) {
      const data = err.response?.data
      if (data?.rejection_reason) {
        toast.error(`Registration rejected: ${data.rejection_reason}`)
      } else {
        toast.error(data?.error || 'Login failed.')
      }
    } finally { setLoading(false) }
  }

  // ── Step 2: verify OTP ────────────────────────────────────────────────────
  const handleOtpSubmit = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) return toast.error('Enter the 6-digit OTP.')
    setLoading(true)
    try {
      const res = await loginStep2(pendingId, otp)
      if (res.new_location) {
        setStep(STEPS.NEW_LOCATION)
      } else {
        toast.success('Welcome back!')
        navigate('/dashboard')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid OTP.')
    } finally { setLoading(false) }
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setResending(true)
    try {
      const res = await resendOtp(pendingId)
      toast.success(res.message)
      if (res.dev_otp) setDevOtp(res.dev_otp)
      setOtp('')
      // 30s cooldown
      setCountdown(30)
      const iv = setInterval(() => {
        setCountdown(c => { if (c <= 1) { clearInterval(iv); return 0 } return c - 1 })
      }, 1000)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not resend OTP.')
    } finally { setResending(false) }
  }

  // ── New-location warning ──────────────────────────────────────────────────
  if (step === STEPS.NEW_LOCATION && loginAlert?.is_new) return (
    <div className="min-h-screen flex items-center justify-center
      bg-gradient-to-br from-yellow-50 to-white px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="card border-2 border-yellow-400 bg-yellow-50 space-y-4 text-center">
          <div className="text-5xl">🗺️</div>
          <h2 className="text-xl font-bold text-yellow-800">New Login Location</h2>
          <p className="text-sm text-gray-600">
            This login is from{' '}
            <span className="font-bold text-yellow-700">{loginAlert.city}</span>,
            which is different from your usual location.
          </p>
          <div className="bg-white border border-yellow-200 rounded-xl p-4 text-left space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span>✅</span>
              <span className="text-gray-600">
                If <strong>this was you</strong>, continue safely.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span>🚨</span>
              <span className="text-gray-600">
                If <strong>this wasn't you</strong>, go to Login Map immediately and flag it.
              </span>
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <button
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl"
              onClick={() => { clearLoginAlert(); navigate('/login-map') }}>
              🗺️ View Login Map (Recommended)
            </button>
            <button
              className="w-full border border-gray-200 text-gray-500 py-2.5 rounded-xl
                hover:bg-gray-50 text-sm"
              onClick={() => { clearLoginAlert(); navigate('/dashboard') }}>
              This was me — Continue to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // ── OTP entry screen ──────────────────────────────────────────────────────
  if (step === STEPS.OTP) return (
    <div className="min-h-screen flex items-center justify-center
      bg-gradient-to-br from-emerald-50 to-white px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center mb-2">
          <div className="text-4xl font-extrabold text-primary">SafePay</div>
          <div className="text-gray-500 mt-1">Two-Factor Authentication</div>
        </div>

        <div className="card space-y-5">
          <div className="text-center">
            <div className="text-4xl mb-2">🔐</div>
            <h2 className="text-xl font-bold">Enter OTP</h2>
            <p className="text-sm text-gray-500 mt-1">
              {hasEmail
                ? 'A 6-digit code has been sent to your registered email.'
                : 'A 6-digit code has been generated.'}
            </p>
          </div>

          {/* Dev mode banner */}
          {devOtp && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <div className="text-xs font-bold text-blue-700 mb-1">
                🧪 DEV MODE — OTP shown for testing
              </div>
              <div className="text-3xl font-extrabold mono text-blue-700 tracking-widest">
                {devOtp}
              </div>
              <div className="text-xs text-blue-500 mt-1">
                Set MAIL_USERNAME in .env to send real emails
              </div>
            </div>
          )}

          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                6-Digit OTP
              </label>
              <input
                className="input-field text-center text-2xl font-bold mono tracking-widest"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="● ● ● ● ● ●"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || otp.length !== 6}>
              {loading ? 'Verifying...' : 'Verify OTP →'}
            </button>
          </form>

          {/* Resend */}
          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-sm text-gray-400">Resend in {countdown}s</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-sm text-primary font-semibold hover:underline">
                {resending ? 'Sending...' : '🔄 Resend OTP'}
              </button>
            )}
          </div>

          <button
            onClick={() => { setStep(STEPS.PIN); setOtp(''); setDevOtp(null) }}
            className="w-full text-sm text-gray-400 hover:text-gray-600 py-1">
            ← Back to Login
          </button>
        </div>

        {/* OTP expiry note */}
        <div className="card bg-yellow-50 border-yellow-200 text-center">
          <div className="text-xs text-yellow-700">
            ⏰ OTP expires in <strong>5 minutes</strong>. Max 3 wrong attempts.
          </div>
        </div>
      </div>
    </div>
  )

  // ── PIN entry screen (Step 1) ─────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center
      bg-gradient-to-br from-emerald-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl font-extrabold text-primary">SafePay</div>
          <div className="text-gray-500 mt-2">Fraud-Resistant Digital Wallet</div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-1">User Login</h2>
          <p className="text-xs text-gray-400 mb-5">
            Step 1 of 2 — verify your phone and PIN
          </p>
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Phone Number
              </label>
              <input
                className="input-field" type="tel" placeholder="01XXXXXXXXX"
                value={pinForm.phone}
                onChange={e => setPinForm({ ...pinForm, phone: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">PIN</label>
              <input
                className="input-field" type="password" placeholder="Enter your PIN"
                value={pinForm.pin}
                onChange={e => setPinForm({ ...pinForm, pin: e.target.value })}
                required maxLength={6}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Checking...' : 'Next — Get OTP →'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            No account?{' '}
            <Link to="/register" className="text-primary font-semibold">Register</Link>
          </p>
        </div>

        <div className="mt-6 card bg-emerald-50 border-primary/20">
          <div className="text-xs text-gray-600 font-semibold mb-2">🧪 Test Credentials</div>
          <div className="mono text-xs space-y-1">
            <div>📱 01711111111  |  PIN: 1234</div>
            <div>📱 01722222222  |  PIN: 1234</div>
          </div>
          <div className="text-xs text-blue-600 mt-2">
            OTP will be shown on screen in dev mode (no email needed)
          </div>
        </div>
      </div>
    </div>
  )
}
