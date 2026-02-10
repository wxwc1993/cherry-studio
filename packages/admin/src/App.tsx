import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'
import AssistantPresets from './pages/AssistantPresets'
import Backups from './pages/Backups'
import Dashboard from './pages/Dashboard'
import Departments from './pages/Departments'
import KnowledgeBases from './pages/KnowledgeBases'
import Login from './pages/Login'
import Models from './pages/Models'
import Roles from './pages/Roles'
import Settings from './pages/Settings'
import Statistics from './pages/Statistics'
import Users from './pages/Users'
import { useAuthStore } from './store/auth'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="departments" element={<Departments />} />
          <Route path="roles" element={<Roles />} />
          <Route path="models" element={<Models />} />
          <Route path="knowledge-bases" element={<KnowledgeBases />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="assistant-presets" element={<AssistantPresets />} />
          <Route path="backups" element={<Backups />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
