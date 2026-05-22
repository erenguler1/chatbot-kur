import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { ForgotPassword } from './pages/ForgotPassword'
import { Dashboard } from './pages/Dashboard'
import { NewBot } from './pages/NewBot'
import { BotDetail } from './pages/BotDetail'
import { BotSettings } from './pages/BotSettings'
import { BotQA } from './pages/BotQA'
import { BotPrompt } from './pages/BotPrompt'
import { BotTest } from './pages/BotTest'
import { Widget } from './pages/Widget'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/widget/:botId" element={<Widget />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bots/new"
            element={
              <ProtectedRoute>
                <NewBot />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bots/:id"
            element={
              <ProtectedRoute>
                <BotDetail />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="settings" replace />} />
            <Route path="settings" element={<BotSettings />} />
            <Route path="qa" element={<BotQA />} />
            <Route path="prompt" element={<BotPrompt />} />
            <Route path="test" element={<BotTest />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
