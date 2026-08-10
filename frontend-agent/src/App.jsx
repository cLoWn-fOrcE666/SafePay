import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import CashIn from './pages/CashIn'
import SendToUser from './pages/SendToUser'
import History from './pages/History'
import Notifications from './pages/Notifications'

function PrivateRoute({ children }) {
  const { agent, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center h-screen text-primary text-xl">
      Loading...
    </div>
  )
  return agent
    ? <SocketProvider><Layout>{children}</Layout></SocketProvider>
    : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { agent, loading } = useAuth()
  if (loading) return null
  return agent ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

          <Route path="/dashboard"     element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/cashin"        element={<PrivateRoute><CashIn /></PrivateRoute>} />
          <Route path="/send"          element={<PrivateRoute><SendToUser /></PrivateRoute>} />
          <Route path="/history"       element={<PrivateRoute><History /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
