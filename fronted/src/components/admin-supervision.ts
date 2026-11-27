import type { UserRole } from "../services/users.service";

type SessionRole = { rol?: UserRole } | null | undefined;

// This is deliberately frontend-development-only. A production build replaces
// import.meta.env.DEV with false, even if an environment variable is supplied.
export function isAdminSupervisionEnabled(user: SessionRole): boolean {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_ADMIN_SUPERVISION_MODE === "true" &&
    user?.rol === "ADMINISTRADOR"
  );
}

export function currentSessionRole(): SessionRole {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}") as SessionRole;
  } catch {
    return null;
  }
}
