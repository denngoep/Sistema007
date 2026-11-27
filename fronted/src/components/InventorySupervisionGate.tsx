import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { currentSessionRole, isAdminSupervisionEnabled } from "./admin-supervision";
import SupervisorPreview from "./SupervisorPreview";
import { getUserPermissions } from "../services/users.service";

const restrictedSections: Record<string, { title: string; description: string; actions: string[] }> = {
  entry: { title: "Recepción de productos", description: "Vista de supervisión de la estructura de recepción y verificación técnica.", actions: ["Registrar recepciones", "Modificar existencias", "Adjuntar facturas"] },
  transfer: { title: "Traslados de inventario", description: "Vista de supervisión del flujo de traslado entre bodegas.", actions: ["Crear traslados", "Modificar existencias", "Registrar devoluciones"] },
  adjustment: { title: "Ajustes de inventario", description: "Vista de supervisión del flujo de conteo físico y ajustes justificados.", actions: ["Confirmar ajustes", "Cargar soportes", "Modificar existencias"] },
};

export default function InventorySupervisionGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [functionalTestAccess, setFunctionalTestAccess] = useState(false);
  const [permissionsVerified, setPermissionsVerified] = useState(false);
  useEffect(() => {
    let active = true;
    getUserPermissions().then((value) => {
      if (!active) return;
      setFunctionalTestAccess(value.functionalTestAccess === true);
      setPermissionsVerified(true);
    }).catch(() => {
      if (!active) return;
      setFunctionalTestAccess(false);
      setPermissionsVerified(true);
    });
    return () => { active = false; };
  }, []);
  const section = new URLSearchParams(location.search).get("section") || "";
  const preview = restrictedSections[section];
  if (preview && isAdminSupervisionEnabled(currentSessionRole()) && !permissionsVerified) {
    return <p>Verificando autorizaciÃ³n...</p>;
  }
  if (preview && !functionalTestAccess && isAdminSupervisionEnabled(currentSessionRole())) {
    return <SupervisorPreview title={preview.title} description={preview.description} unavailableActions={preview.actions} />;
  }
  return <>{children}</>;
}
