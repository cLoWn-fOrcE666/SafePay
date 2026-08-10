import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('admin_access_token')
    if (token) {
      api.get('/auth/me')
        .then(r => setAdmin(r.data.admin))
        .catch(() => logout())
        .finally(() => setLoading(false))
    } else setLoading(false)
  }, [])

  const login = async (username, password) => {
    const r = await api.post('/auth/admin/login', { username, password })
    localStorage.setItem('admin_access_token', r.data.access_token)
    localStorage.setItem('admin_refresh_token', r.data.refresh_token)
    setAdmin(r.data.admin)
    return r.data
  }

  const logout = () => {
    localStorage.removeItem('admin_access_token')
    localStorage.removeItem('admin_refresh_token')
    setAdmin(null)
  }

  return (
    <AuthCtx.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
