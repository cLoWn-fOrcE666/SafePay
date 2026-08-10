import { useState } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const STEPS = { ENTER: 'enter', CONFIRM: 'confirm', DONE: 'done' }

export default function CashOut() {
  const [step, setStep] = useState(STEPS.ENTER)
  const [form, setForm] = useState({ agent_phone: '', amount: '', pin: '' })
  const [agentInfo, setAgentInfo] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = k => e => setForm({ ...form, [k]: e.target.value })

  /* Step 1 — look up the agent */
  const lookupAgent = async () => {
    if (!form.agent_phone) return toast.error('Enter the agent phone number.')
    setLoading(true)
    try {
      const r = await api.post('/transactions/agent-lookup', { phone: form.agent_phone })
      setAgentInfo(r.data)
      setStep(STEPS.CONFIRM)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Agent not found.')
    } finally { setLoading(false) }
  }

  /* Step 2 — confirm and submit */
  const submitCashOut = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('Enter a valid amount.')
    if (!form.pin) return toast.error('Enter your PIN.')
    setLoading(true)
    try {
      const r = await api.post('/transactions/cashout', {
        agent_phone: form.agent_phone,
        amount:      parseFloat(form.amount),
        pin:         form.pin,
      })
      setResult(r.data)
      setStep(STEPS.DONE)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cash-out failed.')
    } finally { setLoading(false) }
  }

  const reset = () => {
    setStep(STEPS.ENTER)
    setForm({ agent_phone: '', amount: '', pin: '' })
    setAgentInfo(null)
    setResult(null)
  }

  /* ── DONE screen ── */
  if (step === STEPS.DONE) return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="card text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold text-primary">Cash-Out Successful</h2>
        <div className="bg-primary-light rounded-xl p-4">
          <div className="text-3xl font-extrabold text-primary mono">
            ৳{parseFloat(form.amount).toFixed(2)}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            sent to agent <span className="font-semibold">{agentInfo?.agent_name}</span>
          </div>
          <div className="text-xs text-gray-400 mono mt-0.5">{form.agent_phone}</div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-left">
          <p className="text-sm font-semibold text-yellow-800 mb-1">⚠️ Next step (important!)</p>
          <p className="text-sm text-yellow-700">
            Show this confirmation to <strong>{agentInfo?.agent_name}</strong> and collect your
            physical cash of <strong>৳{parseFloat(form.amount).toFixed(2)}</strong> from them.
          </p>
        </div>

        <div className="text-sm text-gray-500">
          New balance:&nbsp;
          <span className="font-bold mono text-primary">৳{result?.new_balance?.toFixed(2)}</span>
        </div>

        <button className="btn-primary" onClick={reset}>Cash Out Again</button>
      </div>
    </div>
  )

  /* ── CONFIRM screen ── */
  if (step === STEPS.CONFIRM) return (
    <div className="max-w-md mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Confirm Cash-Out</h1>

      {/* Agent info card */}
      <div className="card border-2 border-primary/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-light rounded-full flex items-center justify-center text-2xl font-bold text-primary">
            🏪
          </div>
          <div>
            <div className="font-bold text-lg">{agentInfo?.agent_name}</div>
            {agentInfo?.business_name && (
              <div className="text-sm text-gray-500">{agentInfo.business_name}</div>
            )}
            <div className="text-xs text-gray-400 mono">{form.agent_phone}</div>
          </div>
          <span className="ml-auto badge-green">✅ Verified Agent</span>
        </div>
      </div>

      {/* How it works reminder */}
      <div className="card bg-blue-50 border-blue-200">
        <p className="text-xs text-blue-700 font-medium mb-1">💡 How cash-out works:</p>
        <ol className="text-xs text-blue-600 space-y-0.5 list-decimal list-inside">
          <li>Your digital wallet is debited immediately</li>
          <li>Agent's wallet is credited</li>
          <li>You collect the physical cash from the agent</li>
        </ol>
      </div>

      {/* Amount + PIN */}
      <div className="card space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Amount to Cash Out (৳)</label>
          <input
            className="input-field text-xl font-bold"
            type="number" min="1" placeholder="0.00"
            value={form.amount} onChange={set('amount')}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Your PIN</label>
          <input
            className="input-field"
            type="password" maxLength={6} placeholder="Enter PIN"
            value={form.pin} onChange={set('pin')}
          />
        </div>

        <button className="btn-primary" disabled={loading} onClick={submitCashOut}>
          {loading ? 'Processing...' : `💵 Cash Out ৳${form.amount || '0'}`}
        </button>
        <button className="btn-outline" onClick={() => setStep(STEPS.ENTER)}>
          ← Change Agent
        </button>
      </div>
    </div>
  )

  /* ── ENTER screen (default) ── */
  return (
    <div className="max-w-md mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Cash Out 💵</h1>

      <div className="card bg-emerald-50 border-primary/20">
        <p className="text-sm text-primary font-semibold mb-2">What is Cash-Out?</p>
        <p className="text-sm text-gray-600">
          Convert your SafePay digital balance into physical cash. Enter your agent's phone number,
          confirm the amount, and collect the cash from them in person.
        </p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Agent's Phone Number
          </label>
          <input
            className="input-field"
            type="tel" placeholder="Agent's phone (01XXXXXXXXX)"
            value={form.agent_phone} onChange={set('agent_phone')}
          />
          <p className="text-xs text-gray-400 mt-1">
            Go to your local SafePay agent and enter their registered phone number.
          </p>
        </div>

        <button className="btn-primary" disabled={loading} onClick={lookupAgent}>
          {loading ? 'Looking up...' : 'Find Agent →'}
        </button>
      </div>
    </div>
  )
}
