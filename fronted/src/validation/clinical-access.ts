// UI gating only. The backend always checks the current database role and JWT.
export function canRegisterClinicalAttention(storedUser: string | null): boolean {
  try {
    const user: unknown = JSON.parse(storedUser ?? 'null');
    return typeof user === 'object' && user !== null &&
      'rol' in user && user.rol === 'MEDICO' &&
      'activo' in user && user.activo === true;
  } catch {
    return false;
  }
}
