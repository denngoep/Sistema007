import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { UserRole } from "../services/users.service";
import { getUserPermissions, USER_ROLES } from "../services/users.service";
import { isAdminSupervisionEnabled } from "./admin-supervision";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  supervisionFallback?: ReactNode;
}

interface SessionUser {
  id: number;
  nombre: string;
  email: string;
  rol?: UserRole;
  activo: boolean;
}

function ProtectedRoute({ children, allowedRoles, supervisionFallback }: ProtectedRouteProps) {
  const token = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");

  if (!token || !storedUser) {
    return <Navigate to="/login" replace />;
  }

  let user: SessionUser;

  try {
    user = JSON.parse(storedUser) as SessionUser;
  } catch {
    return <Navigate to="/login" replace />;
  }

  if (!user || user.activo !== true || !user.rol || !USER_ROLES.includes(user.rol)) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return <FunctionalTestRouteGate user={user} supervisionFallback={supervisionFallback}>{children}</FunctionalTestRouteGate>;
  }

  return <>{children}</>;
}

function FunctionalTestRouteGate({ children, user, supervisionFallback }: { children: ReactNode; user: SessionUser; supervisionFallback?: ReactNode }) {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    getUserPermissions()
      .then((permissions) => { if (active) setVerified(permissions.functionalTestAccess === true); })
      .catch(() => { if (active) setVerified(false); });
    return () => { active = false; };
  }, []);

  if (verified === null) return <p>Verificando autorizaciÃ³n...</p>;
  if (verified) return <>{children}</>;
  if (supervisionFallback && isAdminSupervisionEnabled(user)) return <>{supervisionFallback}</>;
  return <Navigate to="/dashboard" replace />;
}

export default ProtectedRoute;
