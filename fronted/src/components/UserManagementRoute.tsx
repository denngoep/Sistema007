import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { subscribeUserPermissions } from '../services/users.service';
import type { UserManagementPermissions } from '../services/users.service';
import { UserManagementContext } from './user-management-context';

export default function UserManagementRoute({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<UserManagementPermissions | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    return subscribeUserPermissions(value => {
      setPermissions(value); setFailed(false); setVerifiedPath(pathname);
    }, () => { setPermissions(null); setFailed(true); });
  }, [pathname]);
  if (failed || (permissions && !permissions.canManageUsers)) return <Navigate to="/dashboard" replace state={{ userManagementMessage: "No se pudo confirmar tu autorización para administrar usuarios. Verifica tu sesión o consulta al administrador." }} />;
  if (!permissions || verifiedPath !== pathname) return <p>Verificando permisos de administración...</p>;
  const scopeKey = JSON.stringify([permissions.userId, permissions.isAdmin, permissions.servicio?.id, permissions.allowedRoles]);
  return <UserManagementContext.Provider key={scopeKey} value={permissions}>{children}</UserManagementContext.Provider>;
}
