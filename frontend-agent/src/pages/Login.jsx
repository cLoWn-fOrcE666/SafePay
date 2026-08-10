import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ phone: '', pin: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.phone, form.pin)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-100 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl font-extrabold text-primary">SafePay</div>
          <div className="text-gray-500 mt-1">Agent Portal</div>
        </div>
        <div className="card">
          <h2 className="text-xl font-bold mb-6">Agent Login</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Phone Number</label>
              <input className="input-field" type="tel" placeholder="01XXXXXXXXX"
                value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">PIN</label>
              <input className="input-field" type="password" placeholder="Enter PIN"
                value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} required />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            New agent? <Link to="/register" className="text-primary font-semibold">Register</Link>
          </p>
        </div>
        <div className="mt-4 card bg-emerald-50 border-primary/20">
          <div className="text-xs font-semibold mb-1">🧪 Test Agent</div>
          <div className="mono text-xs">📱 01811111111  |  PIN: 5678</div>
        </div>
      </div>
    </div>
  )
}
