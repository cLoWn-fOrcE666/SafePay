import { useState, useEffect } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

export default function GuardianMode() {
  const [guardian, setGuardian] = useState(null)
  const [form, setForm] = useState({ guardian_phone: '', threshold: '500' })
  const [loading, setLoading] = useState(false)

  const fetch = async () => {
    const r = await api.get('/notifications/guardian')
    setGuardian(r.data.guardian)
    if (r.data.guardian) {
      setForm({ guardian_phone: r.data.guardian.guardian_phone, threshold: r.data.guardian.threshold.toString() })
    }
  }
  useEffect(() => { fetch() }, [])

  const save = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/notifications/guardian', { guardian_phone: form.guardian_phone, threshold: parseFloat(form.threshold) })
      toast.success('Guardian mode saved!')
      fetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.')
    } finally { setLoading(false) }
  }

  const disable = async () => {
    if (!confirm('Disable guardian mode?')) return
    await api.post('/notifications/guardian/disable')
    toast.success('Guardian mode disabled.')
    fetch()
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Guardian Mode 🛡️</h1>
      <div className="card bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-700">
          Assign a guardian who gets notified of every transaction above your threshold. 
          Useful for parents monitoring children, or adding an extra safety layer.
        </p>
      </div>

      {guardian?.is_active && (
        <div className="card border-primary/30 bg-primary-light/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-primary">Guardian Active ✅</div>
              <div className="text-sm text-gray-600 mono mt-1">{guardian.guardian_phone}</div>
              <div className="text-xs text-gray-500 mt-1">Notified for transactions above ৳{guardian.threshold}</div>
            </div>
            <button onClick={disable} className="text-xs bg-red-50 text-red-500 px-3 py-2 rounded-xl hover:bg-red-100">
              Disable
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-bold mb-4">{guardian?.is_active ? 'Update Guardian' : 'Set Guardian'}</h2>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Guardian's Phone Number</label>
            <input className="input-field" type="tel" placeholder="01XXXXXXXXX"
              value={form.guardian_phone} onChange={e => setForm({ ...form, guardian_phone: e.target.value })} required />
            <p className="text-xs text-gray-400 mt-1">They must be a registered SafePay user</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Notification Threshold (৳)</label>
            <input className="input-field" type="number" min="1" placeholder="500"
              value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })} required />
            <p className="text-xs text-gray-400 mt-1">Guardian is notified when you send more than this amount</p>
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : '🛡️ Save Guardian Settings'}
          </button>
        </form>
      </div>
    </div>
  )
}
