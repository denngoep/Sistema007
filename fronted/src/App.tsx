import { BrowserRouter, Route, Routes } from "react-router-dom";
import type { UserRole } from "./services/users.service";

import Home from "./pages/Home";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";

import Users from "./pages/Users";
import CreateUser from "./pages/CreateUser";
import EditUser from "./pages/EditUser";

import Patients from "./pages/Patients";
import CreatePatient from "./pages/CreatePatient";
import EditPatient from "./pages/EditPatient";

import ClinicalHistories from "./pages/ClinicalHistories";
import ClinicalHistory from "./pages/ClinicalHistory";

import Inventory from "./pages/Inventory";
import InventoryReceiptManage from "./pages/InventoryReceiptManage";
import InventoryMovements from "./pages/InventoryMovements";

import Dispensations from "./pages/Dispensations";
import Reports from "./pages/Reports";

import ProtectedRoute from "./components/ProtectedRoute";
import UserManagementRoute from "./components/UserManagementRoute";
import ModuleNavigation from "./components/ModuleNavigation";
import SupervisorPreview from "./components/SupervisorPreview";
import InventorySupervisionGate from "./components/InventorySupervisionGate";

// Administración general de usuarios.

// Roles autorizados para consultar pacientes.
const PATIENT_ROLES: UserRole[] = [
  "ADMINISTRADOR",
  "MEDICO",
  "ENFERMERO",
  "AUXILIAR_ENFERMERIA",
  "RECEPCION_ADMISIONES",
  "REGENTE_FARMACIA",
  "AUXILIAR_FARMACIA",
  "QUIMICO_FARMACEUTICO",
];

// Rol autorizado para registrar y editar pacientes.
const PATIENT_MANAGEMENT_ROLES: UserRole[] = ["ADMINISTRADOR", "RECEPCION_ADMISIONES"];

// Roles autorizados para consultar historias clínicas.
const CLINICAL_ROLES: UserRole[] = ["ADMINISTRADOR", "MEDICO", "ENFERMERO"];

// Roles autorizados para acceder a inventario.
const INVENTORY_ROLES: UserRole[] = [
  "ADMINISTRADOR",
  "REGENTE_FARMACIA",
  "AUXILIAR_FARMACIA",
  "QUIMICO_FARMACEUTICO",
];

// Roles autorizados para gestionar recepciones.
const INVENTORY_MANAGEMENT_ROLES: UserRole[] = [
  "ADMINISTRADOR",
  "REGENTE_FARMACIA",
  "QUIMICO_FARMACEUTICO",
];

// Roles autorizados para dispensar medicamentos.
const DISPENSATION_ROLES: UserRole[] = [
  "ADMINISTRADOR",
  "REGENTE_FARMACIA",
  "QUIMICO_FARMACEUTICO",
  "AUXILIAR_FARMACIA",
];

const REPORT_ROLES: UserRole[] = [
  "ADMINISTRADOR",
  ...DISPENSATION_ROLES,
];

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />

        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Panel principal */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <ModuleNavigation><Dashboard /></ModuleNavigation>
            </ProtectedRoute>
          }
        />

        {/* Administración de usuarios */}
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <UserManagementRoute><ModuleNavigation><Users /></ModuleNavigation></UserManagementRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/users/new"
          element={
            <ProtectedRoute>
              <UserManagementRoute><ModuleNavigation><CreateUser /></ModuleNavigation></UserManagementRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/users/:id/edit"
          element={
            <ProtectedRoute>
              <UserManagementRoute><ModuleNavigation><EditUser /></ModuleNavigation></UserManagementRoute>
            </ProtectedRoute>
          }
        />

        {/* Consulta de pacientes */}
        <Route
          path="/patients"
          element={
            <ProtectedRoute allowedRoles={PATIENT_ROLES}>
              <ModuleNavigation><Patients /></ModuleNavigation>
            </ProtectedRoute>
          }
        />

        {/* Registro de pacientes */}
        <Route
          path="/patients/new"
          element={
            <ProtectedRoute allowedRoles={PATIENT_MANAGEMENT_ROLES}>
              <ModuleNavigation><CreatePatient /></ModuleNavigation>
            </ProtectedRoute>
          }
        />

        {/* Edición de pacientes */}
        <Route
          path="/patients/:id/edit"
          element={
            <ProtectedRoute allowedRoles={PATIENT_MANAGEMENT_ROLES}>
              <ModuleNavigation><EditPatient /></ModuleNavigation>
            </ProtectedRoute>
          }
        />

        {/* Historias clínicas */}
        <Route
          path="/clinical-history"
          element={
            <ProtectedRoute allowedRoles={CLINICAL_ROLES} supervisionFallback={<ModuleNavigation><SupervisorPreview title="Historia clínica" description="Vista de supervisión de la estructura clínica sin consultar historias, diagnósticos ni formulaciones reales." unavailableActions={["Buscar pacientes para atención", "Consultar historias clínicas", "Registrar atenciones"]} /></ModuleNavigation>}>
              <ModuleNavigation><ClinicalHistories /></ModuleNavigation>
            </ProtectedRoute>
          }
        />

        <Route
          path="/clinical-history/patient/:patientId"
          element={
            <ProtectedRoute allowedRoles={CLINICAL_ROLES} supervisionFallback={<ModuleNavigation><SupervisorPreview title="Historia clínica" description="Vista de supervisión de la estructura clínica sin consultar historias, diagnósticos ni formulaciones reales." unavailableActions={["Consultar historias clínicas", "Registrar atenciones", "Crear diagnósticos o formulaciones"]} /></ModuleNavigation>}>
              <ModuleNavigation><ClinicalHistory /></ModuleNavigation>
            </ProtectedRoute>
          }
        />

        {/* Inventario */}
        <Route
          path="/inventory"
          element={
            <ProtectedRoute allowedRoles={INVENTORY_ROLES}>
              <ModuleNavigation><InventorySupervisionGate><Inventory /></InventorySupervisionGate></ModuleNavigation>
            </ProtectedRoute>
          }
        />

        {/* Gestión de recepciones: acceso restringido */}
        <Route
          path="/inventory/receipts/:id/edit"
          element={
            <ProtectedRoute allowedRoles={INVENTORY_MANAGEMENT_ROLES} supervisionFallback={<ModuleNavigation><SupervisorPreview title="Gestión de recepción" description="Vista de supervisión sin cargar una recepción ni sus documentos reales." unavailableActions={["Revisar recepciones", "Corregir verificaciones", "Adjuntar facturas"]} /></ModuleNavigation>}>
              <ModuleNavigation><InventoryReceiptManage /></ModuleNavigation>
            </ProtectedRoute>
          }
        />

        {/* Consulta de movimientos */}
        <Route
          path="/inventory/movements"
          element={
            <ProtectedRoute allowedRoles={INVENTORY_ROLES}>
              <ModuleNavigation><InventoryMovements /></ModuleNavigation>
            </ProtectedRoute>
          }
        />

        {/* Gestión de dispensaciones */}
        <Route
          path="/dispensations"
          element={
            <ProtectedRoute allowedRoles={DISPENSATION_ROLES} supervisionFallback={<ModuleNavigation><SupervisorPreview title="Dispensación" description="Vista de supervisión de la estructura de entregas y soportes sin consultar pacientes, formulaciones o dispensaciones reales." unavailableActions={["Consultar formulaciones", "Registrar entregas", "Generar comprobantes o firmas"]} /></ModuleNavigation>}>
              <ModuleNavigation><Dispensations /></ModuleNavigation>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={REPORT_ROLES}>
              <ModuleNavigation><Reports /></ModuleNavigation>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
