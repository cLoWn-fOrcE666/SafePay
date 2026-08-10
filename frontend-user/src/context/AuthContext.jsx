import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null)
  const [balance,     setBalance]     = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [loginAlert,  setLoginAlert]  = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      api.get('/auth/me')
        .then(r => { setUser(r.data.user); setBalance(r.data.balance) })
        .catch(() => logout())
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  /**
   * Step 1 — verifies phone + PIN, returns OTP challenge info.
   * Returns { otp_required: true, user_id, dev_mode, dev_otp?, has_email }
   */
  const loginStep1 = async (phone, pin) => {
    const r = await api.post('/auth/user/login', { phone, pin })
    return r.data   // caller handles routing to OTP screen
  }

  /**
   * Step 2 — submits OTP, receives JWT tokens and completes login.
   */
  const loginStep2 = async (userId, otp) => {
    const r = await api.post('/auth/user/verify-otp', { user_id: userId, otp })
    localStorage.setItem('access_token',  r.data.access_token)
    localStorage.setItem('refresh_token', r.data.refresh_token)
    setUser(r.data.user)
    setBalance(r.data.balance || 0)
    if (r.data.new_location) {
      setLoginAlert({ city: r.data.login_city, is_new: true })
    } else {
      setLoginAlert({ city: r.data.login_city, is_new: false })
    }
    return r.data
  }

  const resendOtp = async (userId) => {
    const r = await api.post('/auth/user/resend-otp', { user_id: userId })
    return r.data
  }

  const register = async (formData) => {
    // formData is a FormData object (multipart) containing files
    const r = await fetch('/api/auth/user/register', { method: 'POST', body: formData })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Registration failed.')
    return data
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
    setBalance(0)
    setLoginAlert(null)
  }

  const clearLoginAlert = () => setLoginAlert(null)

  return (
    <AuthCtx.Provider value={{
      user, balance, setBalance, loading,
      loginStep1, loginStep2, resendOtp, register, logout,
      loginAlert, clearLoginAlert,
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
