import { createContext, useContext } from 'react';
import type { UserManagementPermissions } from '../services/users.service';

export const UserManagementContext = createContext<UserManagementPermissions | null>(null);
export function useUserManagement() {
  const permissions = useContext(UserManagementContext);
  if (!permissions) throw new Error('Falta verificar los permisos de administración');
  return permissions;
}
