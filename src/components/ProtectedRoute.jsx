import { Navigate, useLocation } from 'react-router-dom'
import { activeUser, hasPermission, isInstallationMode } from '../services/permissions'
import { capabilityForPath, hasEntitlement } from '../domain/entitlements'
import { useStore } from '../services/store'

export default function ProtectedRoute({ children, permission = '', entitlement = '' }) {
  const { state } = useStore()
  const location = useLocation()
  const user = activeUser(state)
  const installationMode = isInstallationMode(state)

  if (!installationMode && !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const requiredCapability = entitlement || capabilityForPath(location.pathname)
  if (requiredCapability && !hasEntitlement(state, requiredCapability)) {
    return <Navigate to="/dashboard" replace state={{ deniedEntitlement: requiredCapability }} />
  }

  if (permission && !hasPermission(state, permission)) {
    return <Navigate to="/dashboard" replace state={{ denied: permission }} />
  }

  return children
}
