import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.username, form.password)
      toast.success('Welcome, Admin!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl font-extrabold text-primary">SafePay</div>
          <div className="text-gray-500 mt-1">Admin Control Panel</div>
        </div>
        <div className="card">
          <h2 className="text-xl font-bold mb-6">Admin Login</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Username</label>
              <input className="input-field" placeholder="admin"
                value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Password</label>
              <input className="input-field" type="password" placeholder="Enter password"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
        <div className="mt-4 card bg-blue-50 border-primary/20">
          <div className="text-xs font-semibold mb-1">🧪 Test Credentials</div>
          <div className="mono text-xs">username: admin  |  password: admin123</div>
        </div>
      </div>
    </div>
  )
}
