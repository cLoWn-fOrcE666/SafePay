import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CashInRequests from './pages/CashInRequests'
import AgentApprovals from './pages/AgentApprovals'
import UserKYCApprovals from './pages/UserKYCApprovals'
import Users from './pages/Users'
import Agents from './pages/Agents'
import Transactions from './pages/Transactions'
import FraudAlerts from './pages/FraudAlerts'
import BalanceAdjust from './pages/BalanceAdjust'

function PrivateRoute({ children }) {
  const { admin, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center h-screen text-primary text-xl">
      Loading...
    </div>
  )
  return admin ? <Layout>{children}</Layout> : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { admin, loading } = useAuth()
  if (loading) return null
  return admin ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

          <Route path="/dashboard"      element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/cashin"         element={<PrivateRoute><CashInRequests /></PrivateRoute>} />
          <Route path="/agents/pending" element={<PrivateRoute><AgentApprovals /></PrivateRoute>} />
          <Route path="/users/pending"  element={<PrivateRoute><UserKYCApprovals /></PrivateRoute>} />
          <Route path="/users"          element={<PrivateRoute><Users /></PrivateRoute>} />
          <Route path="/agents"         element={<PrivateRoute><Agents /></PrivateRoute>} />
          <Route path="/transactions"   element={<PrivateRoute><Transactions /></PrivateRoute>} />
          <Route path="/fraud"          element={<PrivateRoute><FraudAlerts /></PrivateRoute>} />
          <Route path="/balance"        element={<PrivateRoute><BalanceAdjust /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
