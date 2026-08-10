import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [agent, setAgent] = useState(null)
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('agent_access_token')
    if (token) {
      api.get('/auth/me')
        .then(r => { setAgent(r.data.agent); setBalance(r.data.balance) })
        .catch(() => logout())
        .finally(() => setLoading(false))
    } else setLoading(false)
  }, [])

  const login = async (phone, pin) => {
    const r = await api.post('/auth/agent/login', { phone, pin })
    localStorage.setItem('agent_access_token', r.data.access_token)
    localStorage.setItem('agent_refresh_token', r.data.refresh_token)
    setAgent(r.data.agent)
    return r.data
  }

  const register = async (data) => {
    const r = await api.post('/auth/agent/register', data)
    return r.data
  }

  const logout = () => {
    localStorage.removeItem('agent_access_token')
    localStorage.removeItem('agent_refresh_token')
    setAgent(null)
    setBalance(0)
  }

  return (
    <AuthCtx.Provider value={{ agent, balance, setBalance, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
