import { Navigate, useLocation } from 'react-router-dom'
import { activeUser, hasPermission, isInstallationMode } from '../services/permissions'
import { useStore } from '../services/store'

export default function ProtectedRoute({ children, permission = '' }) {
  const { state } = useStore()
  const location = useLocation()
  const user = activeUser(state)
  const installationMode = isInstallationMode(state)

  if (!installationMode && !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (permission && !hasPermission(state, permission)) {
    return <Navigate to="/dashboard" replace state={{ denied: permission }} />
  }

  return children
}
