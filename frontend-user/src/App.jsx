import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import SendMoney from './pages/SendMoney'
import CashOut from './pages/CashOut'
import RequestMoney from './pages/RequestMoney'
import TransactionHistory from './pages/TransactionHistory'
import TrustedContacts from './pages/TrustedContacts'
import GuardianMode from './pages/GuardianMode'
import Notifications from './pages/Notifications'
import LoginMap from './pages/LoginMap'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center h-screen text-primary text-xl">
      Loading...
    </div>
  )
  return user ? (
    <SocketProvider>
      <Layout>{children}</Layout>
    </SocketProvider>
  ) : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

          <Route path="/dashboard"     element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/send"          element={<PrivateRoute><SendMoney /></PrivateRoute>} />
          <Route path="/cashout"       element={<PrivateRoute><CashOut /></PrivateRoute>} />
          <Route path="/request"       element={<PrivateRoute><RequestMoney /></PrivateRoute>} />
          <Route path="/history"       element={<PrivateRoute><TransactionHistory /></PrivateRoute>} />
          <Route path="/trusted"       element={<PrivateRoute><TrustedContacts /></PrivateRoute>} />
          <Route path="/guardian"      element={<PrivateRoute><GuardianMode /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          <Route path="/login-map"     element={<PrivateRoute><LoginMap /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
