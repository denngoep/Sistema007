import { useEffect, useState } from "react";
import { subscribeUserPermissions } from "../services/users.service";

// This only controls the local interface. Every operation remains verified by
// the backend against the isolated database and the authenticated user.
export function useFunctionalTestAccess(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => subscribeUserPermissions(
    (permissions) => setEnabled(permissions.functionalTestAccess === true),
    () => setEnabled(false),
  ), []);

  return enabled;
}
