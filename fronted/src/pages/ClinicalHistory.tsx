import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  createClinicalAttention,
  getClinicalHistoryByPatient,
} from "../services/clinical-history.service";

import {
  createFormulation,
  createPatientDiagnosis,
  getActiveDiagnosesByPatient,
  getActiveFormulationsByPatient,
} from "../services/formulations.service";

import type { ClinicalHistoryResponse } from "../services/clinical-history.service";
import type {
  FormulationMedication,
  PatientDiagnosis,
} from "../services/formulations.service";

import "../styles/ClinicalHistory.css";

interface FormulationDiagnosis {
  id: number;
  nombre: string;
  codigoCie10: string | null;
  tipo: string;
  requiereEsquema: boolean;
}

interface FormulationClinicalAttention {
  id: number;
  numeroIngreso: string;
  fechaAtencion: string;
  profesional: {
    id: number;
    nombre: string;
    rol: string;
  };
}

interface ActiveFormulation {
  id: number;
  atencionClinicaId: number;
  diagnosticoPacienteId: number | null;
  fechaFormulacion: string;
  vigenciaMeses: number;
  indicaciones: string | null;
  estado: string;
  fechaVencimiento: string;

  diagnosticoPaciente: FormulationDiagnosis | null;

  medicamentos: Array<
    FormulationMedication & {
      id: number;
      formulacionId: number;
    }
  >;

  atencionClinica: FormulationClinicalAttention;
}

interface ActiveFormulationsResponse {
  paciente: {
    id: number;
    tipoDocumento: string;
    numeroDocumento: string;
    nombres: string;
    apellidos: string;
    activo: boolean;
  };

  totalFormulacionesVigentes: number;
  formulaciones: ActiveFormulation[];
}

interface MedicationForm {
  medicamento: string;
  concentracion: string;
  formaFarmaceutica: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
  cantidad: string;
  viaAdministracion: string;
  observaciones: string;
}

type DiagnosisType = "AGUDO" | "CRONICO" | "OTRO";

interface PendingDiagnosis {
  codigoCie10: string;
  nombre: string;
  tipo: DiagnosisType;
  requiereEsquema: boolean;
  observaciones?: string;
}

const emptyMedication = (): MedicationForm => ({
  medicamento: "",
  concentracion: "",
  formaFarmaceutica: "",
  dosis: "",
  frecuencia: "",
  duracion: "",
  cantidad: "1",
  viaAdministracion: "",
  observaciones: "",
});

function ClinicalHistory() {
  const navigate = useNavigate();
  const { patientId } = useParams();

  const [data, setData] = useState<ClinicalHistoryResponse | null>(null);

  const [formulations, setFormulations] =
    useState<ActiveFormulationsResponse | null>(null);

  const [patientDiagnoses, setPatientDiagnoses] = useState<PatientDiagnosis[]>(
    [],
  );

  const [diagnosticoPacienteId, setDiagnosticoPacienteId] = useState("");

  const [pendingDiagnosis, setPendingDiagnosis] =
    useState<PendingDiagnosis | null>(null);

  const [expandedFormulationId, setExpandedFormulationId] = useState<
    number | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAttentionForm, setShowAttentionForm] = useState(false);

  const [motivoConsulta, setMotivoConsulta] = useState("");
  const [evolucion, setEvolucion] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [observacionesAtencion, setObservacionesAtencion] = useState("");

  const [vigenciaMeses, setVigenciaMeses] = useState("1");
  const [indicaciones, setIndicaciones] = useState("");

  const [medicamentos, setMedicamentos] = useState<MedicationForm[]>([
    emptyMedication(),
  ]);

  const [savingAttention, setSavingAttention] = useState(false);
  const [attentionError, setAttentionError] = useState("");
  const [attentionSuccess, setAttentionSuccess] = useState("");

  const [showNewDiagnosisForm, setShowNewDiagnosisForm] = useState(false);

  const [newDiagnosisCode, setNewDiagnosisCode] = useState("");
  const [newDiagnosisName, setNewDiagnosisName] = useState("");

  const [newDiagnosisType, setNewDiagnosisType] =
    useState<DiagnosisType>("AGUDO");

  const [newDiagnosisRequiresScheme, setNewDiagnosisRequiresScheme] =
    useState(false);

  const [newDiagnosisObservations, setNewDiagnosisObservations] = useState("");

  const [diagnosisError, setDiagnosisError] = useState("");
  const [, setDiagnosisSuccess] = useState("");

  const loadClinicalHistory = useCallback(async () => {
    const id = Number(patientId);

    if (!patientId || Number.isNaN(id)) {
      setError("El paciente seleccionado no es válido");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [clinicalHistoryResponse, formulationsResponse, diagnosesResponse] =
        await Promise.all([
          getClinicalHistoryByPatient(id),
          getActiveFormulationsByPatient(id),
          getActiveDiagnosesByPatient(id),
        ]);

      setData(clinicalHistoryResponse);
      setFormulations(formulationsResponse);
      setPatientDiagnoses(diagnosesResponse.diagnosticos);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("No fue posible consultar la historia clínica");
      }
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadClinicalHistory();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadClinicalHistory]);

  const formatDate = (date?: string | null) => {
    if (!date) {
      return "No registrada";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    });
  };

  const toggleFormulation = (formulationId: number) => {
    setExpandedFormulationId((currentId) =>
      currentId === formulationId ? null : formulationId,
    );
  };

  const clearNewDiagnosisFields = () => {
    setNewDiagnosisCode("");
    setNewDiagnosisName("");
    setNewDiagnosisType("AGUDO");
    setNewDiagnosisRequiresScheme(false);
    setNewDiagnosisObservations("");
    setDiagnosisError("");
  };

  const clearAttentionForm = () => {
    setMotivoConsulta("");
    setEvolucion("");
    setDiagnostico("");
    setObservacionesAtencion("");

    setVigenciaMeses("1");
    setIndicaciones("");
    setDiagnosticoPacienteId("");
    setPendingDiagnosis(null);

    setMedicamentos([emptyMedication()]);

    setShowNewDiagnosisForm(false);
    clearNewDiagnosisFields();

    setDiagnosisSuccess("");
    setAttentionError("");
  };

  const handleOpenAttentionForm = () => {
    setAttentionSuccess("");
    setAttentionError("");
    setShowAttentionForm(true);
  };

  const handleCancelAttention = () => {
    clearAttentionForm();
    setShowAttentionForm(false);
  };

  const handleOpenNewDiagnosis = () => {
    setDiagnosisError("");
    setDiagnosisSuccess("");
    setShowNewDiagnosisForm(true);
  };

  const handleCancelNewDiagnosis = () => {
    clearNewDiagnosisFields();
    setShowNewDiagnosisForm(false);
  };

  const handlePrepareNewDiagnosis = () => {
    const codigoCie10 = newDiagnosisCode.trim().toUpperCase();

    const nombre = newDiagnosisName.trim();

    if (!codigoCie10) {
      setDiagnosisError("Debe registrar el código CIE-10");
      return;
    }

    if (!nombre) {
      setDiagnosisError("Debe registrar el nombre del diagnóstico");
      return;
    }

    const duplicateDiagnosis = patientDiagnoses.find(
      (diagnosis) => diagnosis.codigoCie10?.toUpperCase() === codigoCie10,
    );

    if (duplicateDiagnosis) {
      setDiagnosisError(
        "El paciente ya tiene registrado un diagnóstico activo con este código CIE-10",
      );
      return;
    }

    setPendingDiagnosis({
      codigoCie10,
      nombre,
      tipo: newDiagnosisType,
      requiereEsquema: newDiagnosisRequiresScheme,
      observaciones: newDiagnosisObservations.trim() || undefined,
    });

    setDiagnosticoPacienteId("");
    setDiagnostico(nombre);

    setDiagnosisError("");
    setDiagnosisSuccess(
      `${codigoCie10} — ${nombre} quedará registrado al guardar la atención`,
    );

    setShowNewDiagnosisForm(false);
    clearNewDiagnosisFields();
  };

  const handleRemovePendingDiagnosis = () => {
    setPendingDiagnosis(null);
    setDiagnosticoPacienteId("");
    setDiagnosisSuccess("");
  };

  const handleMedicationChange = (
    index: number,
    field: keyof MedicationForm,
    value: string,
  ) => {
    setMedicamentos((currentMedications) =>
      currentMedications.map((medication, medicationIndex) =>
        medicationIndex === index
          ? {
              ...medication,
              [field]: value,
            }
          : medication,
      ),
    );
  };

  const handleAddMedication = () => {
    setMedicamentos((currentMedications) => [
      ...currentMedications,
      emptyMedication(),
    ]);
  };

  const handleRemoveMedication = (index: number) => {
    setMedicamentos((currentMedications) => {
      if (currentMedications.length === 1) {
        return currentMedications;
      }

      return currentMedications.filter(
        (_, medicationIndex) => medicationIndex !== index,
      );
    });
  };

  const handleCreateAttention = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const id = Number(patientId);

    if (!patientId || Number.isNaN(id)) {
      setAttentionError("El paciente seleccionado no es válido");
      return;
    }

    if (!motivoConsulta.trim()) {
      setAttentionError("Debe registrar el motivo de consulta");
      return;
    }

    if (!evolucion.trim()) {
      setAttentionError("Debe registrar la evolución del paciente");
      return;
    }

    if (!diagnostico.trim()) {
      setAttentionError("Debe registrar el diagnóstico");
      return;
    }

    if (!diagnosticoPacienteId && !pendingDiagnosis) {
      setAttentionError(
        "Debe seleccionar un diagnóstico existente o registrar uno nuevo",
      );
      return;
    }

    const parsedVigencia = Number(vigenciaMeses);

    if (
      Number.isNaN(parsedVigencia) ||
      !Number.isInteger(parsedVigencia) ||
      parsedVigencia < 1
    ) {
      setAttentionError(
        "La vigencia de la formulación debe ser mínimo de 1 mes",
      );
      return;
    }

    const hasIncompleteMedication = medicamentos.some((medication) => {
      const cantidad = Number(medication.cantidad);

      return (
        !medication.medicamento.trim() ||
        !medication.dosis.trim() ||
        !medication.frecuencia.trim() ||
        Number.isNaN(cantidad) ||
        !Number.isInteger(cantidad) ||
        cantidad < 1
      );
    });

    if (hasIncompleteMedication) {
      setAttentionError(
        "Cada medicamento debe tener nombre, dosis, frecuencia y una cantidad válida",
      );
      return;
    }

    try {
      setSavingAttention(true);
      setAttentionError("");
      setAttentionSuccess("");

      const attentionResponse = await createClinicalAttention({
        pacienteId: id,

        // Temporalmente usamos el profesional 1.
        // Después se tomará del usuario autenticado.
        profesionalId: 1,

        motivoConsulta: motivoConsulta.trim(),
        evolucion: evolucion.trim(),
        diagnostico: diagnostico.trim(),

        observaciones: observacionesAtencion.trim() || undefined,
      });

      let diagnosisId: number;

      if (pendingDiagnosis) {
        const diagnosisResponse = await createPatientDiagnosis({
          pacienteId: id,

          atencionClinicaId: attentionResponse.atencionClinica.id,

          nombre: pendingDiagnosis.nombre,
          codigoCie10: pendingDiagnosis.codigoCie10,
          tipo: pendingDiagnosis.tipo,

          requiereEsquema: pendingDiagnosis.requiereEsquema,

          observaciones: pendingDiagnosis.observaciones,
        });

        diagnosisId = diagnosisResponse.diagnostico.id;
      } else {
        diagnosisId = Number(diagnosticoPacienteId);
      }

      await createFormulation({
        atencionClinicaId: attentionResponse.atencionClinica.id,

        diagnosticoPacienteId: diagnosisId,

        vigenciaMeses: parsedVigencia,

        indicaciones: indicaciones.trim() || undefined,

        medicamentos: medicamentos.map((medication) => ({
          medicamento: medication.medicamento.trim(),

          concentracion: medication.concentracion.trim() || undefined,

          formaFarmaceutica: medication.formaFarmaceutica.trim() || undefined,

          dosis: medication.dosis.trim(),

          frecuencia: medication.frecuencia.trim(),

          duracion: medication.duracion.trim() || undefined,

          cantidad: Number(medication.cantidad),

          viaAdministracion: medication.viaAdministracion.trim() || undefined,

          observaciones: medication.observaciones.trim() || undefined,
        })),
      });

      setAttentionSuccess(
        `Atención, diagnóstico y formulación registrados correctamente. Ingreso ${attentionResponse.numeroIngreso}`,
      );

      clearAttentionForm();
      setShowAttentionForm(false);

      await loadClinicalHistory();
    } catch (error) {
      if (error instanceof Error) {
        setAttentionError(error.message);
      } else {
        setAttentionError(
          "No fue posible registrar la atención y la formulación",
        );
      }
    } finally {
      setSavingAttention(false);
    }
  };

  if (loading) {
    return (
      <main className="clinical-history-page">
        <section className="clinical-history-state">
          <span className="clinical-history-section-label">Sistema007</span>

          <h2>Historia clínica</h2>

          <p>Consultando información del paciente...</p>
        </section>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="clinical-history-page">
        <section className="clinical-history-state">
          <span className="clinical-history-section-label">Sistema007</span>

          <h2>Historia clínica</h2>

          <p className="clinical-history-error">
            {error || "No se encontró la historia clínica"}
          </p>

          <button type="button" onClick={() => navigate("/clinical-history")}>
            Volver a historias clínicas
          </button>
        </section>
      </main>
    );
  }

  const { paciente, historiaClinica } = data;

  const activeFormulations = formulations?.formulaciones ?? [];

  const clinicalAttentions = historiaClinica.atenciones ?? [];

  return (
    <main className="clinical-history-page">
      <header className="clinical-history-header">
        <div>
          <span className="clinical-history-section-label">Sistema007</span>

          <h1>Historia clínica</h1>

          <p>Gestión de la información clínica del paciente.</p>
        </div>

        <button
          type="button"
          className="clinical-history-back"
          onClick={() => navigate("/clinical-history")}
        >
          Volver a historias clínicas
        </button>
      </header>

      <section className="clinical-history-content">
        <div className="clinical-history-summary">
          <div>
            <span>Historia clínica</span>
            <strong>HC-{historiaClinica.id}</strong>
          </div>

          <div>
            <span>Paciente</span>
            <strong>
              {paciente.nombres} {paciente.apellidos}
            </strong>
          </div>

          <div>
            <span>Documento</span>
            <strong>
              {paciente.tipoDocumento} {paciente.numeroDocumento}
            </strong>
          </div>

          <div>
            <span>Fecha de nacimiento</span>
            <strong>{formatDate(paciente.fechaNacimiento)}</strong>
          </div>
        </div>

        <div className="clinical-history-sections">
          <article className="clinical-history-card">
            <div className="clinical-history-card-header">
              <div>
                <span>Información clínica</span>
                <h2>Datos generales</h2>
              </div>
            </div>

            <div className="clinical-history-general-data">
              <div>
                <span>Grupo sanguíneo</span>
                <strong>
                  {historiaClinica.grupoSanguineo || "No registrado"}
                </strong>
              </div>

              <div>
                <span>Alergias</span>
                <p>{historiaClinica.alergias || "No se registran alergias"}</p>
              </div>

              <div>
                <span>Antecedentes</span>
                <p>
                  {historiaClinica.antecedentes ||
                    "No se registran antecedentes"}
                </p>
              </div>

              <div>
                <span>Diagnósticos</span>
                <p>
                  {historiaClinica.diagnosticos ||
                    "No se registran diagnósticos"}
                </p>
              </div>

              <div>
                <span>Observaciones</span>
                <p>
                  {historiaClinica.observaciones ||
                    "Sin observaciones registradas"}
                </p>
              </div>
            </div>
          </article>

          <article className="clinical-history-card">
            <div className="clinical-history-card-header">
              <div>
                <span>Consulta médica</span>
                <h2>Atenciones clínicas</h2>
              </div>

              {!showAttentionForm && (
                <button
                  type="button"
                  className="clinical-history-action-button"
                  onClick={handleOpenAttentionForm}
                >
                  + Nueva atención
                </button>
              )}
            </div>

            {attentionSuccess && (
              <div className="clinical-history-success">{attentionSuccess}</div>
            )}

            {showAttentionForm && (
              <form
                className="clinical-history-attention-form"
                onSubmit={handleCreateAttention}
              >
                <section className="clinical-history-form-section">
                  <div className="clinical-history-form-section-header">
                    <span>Atención médica</span>
                    <h3>Registro clínico</h3>

                    <p>
                      El número de ingreso será generado automáticamente al
                      guardar la atención.
                    </p>
                  </div>

                  <div className="clinical-history-form-grid">
                    <div className="clinical-history-form-field full-width">
                      <label htmlFor="motivoConsulta">
                        Motivo de consulta *
                      </label>

                      <textarea
                        id="motivoConsulta"
                        value={motivoConsulta}
                        onChange={(event) =>
                          setMotivoConsulta(event.target.value)
                        }
                        placeholder="Ingrese el motivo de consulta"
                        rows={3}
                      />
                    </div>

                    <div className="clinical-history-form-field full-width">
                      <label htmlFor="evolucion">Evolución *</label>

                      <textarea
                        id="evolucion"
                        value={evolucion}
                        onChange={(event) => setEvolucion(event.target.value)}
                        placeholder="Registre la evolución clínica del paciente"
                        rows={4}
                      />
                    </div>

                    <div className="clinical-history-form-field full-width">
                      <label htmlFor="diagnostico">Diagnóstico *</label>

                      <textarea
                        id="diagnostico"
                        value={diagnostico}
                        onChange={(event) => setDiagnostico(event.target.value)}
                        placeholder="Ingrese el diagnóstico"
                        rows={3}
                      />
                    </div>

                    <div className="clinical-history-form-field full-width">
                      <label htmlFor="observacionesAtencion">
                        Observaciones
                      </label>

                      <textarea
                        id="observacionesAtencion"
                        value={observacionesAtencion}
                        onChange={(event) =>
                          setObservacionesAtencion(event.target.value)
                        }
                        placeholder="Observaciones adicionales"
                        rows={3}
                      />
                    </div>
                  </div>
                </section>
                <section className="clinical-history-form-section">
                  <div className="clinical-history-form-section-header">
                    <span>Tratamiento</span>
                    <h3>Formulación</h3>

                    <p>
                      La formulación quedará asociada al mismo número de ingreso
                      de esta atención.
                    </p>
                  </div>

                  <div className="clinical-history-form-grid two-columns">
                    <div className="clinical-history-form-field full-width">
                      <label htmlFor="diagnosticoPacienteId">
                        Diagnóstico asociado / CIE-10 *
                      </label>

                      <select
                        id="diagnosticoPacienteId"
                        value={diagnosticoPacienteId}
                        onChange={(event) => {
                          const value = event.target.value;

                          setDiagnosticoPacienteId(value);
                          setPendingDiagnosis(null);
                          setDiagnosisSuccess("");

                          const selectedDiagnosis = patientDiagnoses.find(
                            (diagnosis) => String(diagnosis.id) === value,
                          );

                          if (selectedDiagnosis) {
                            setDiagnostico(selectedDiagnosis.nombre);
                          }
                        }}
                      >
                        <option value="">Seleccione un diagnóstico</option>

                        {patientDiagnoses.map((diagnosis) => (
                          <option key={diagnosis.id} value={diagnosis.id}>
                            {diagnosis.codigoCie10
                              ? `${diagnosis.codigoCie10} — ${diagnosis.nombre}`
                              : diagnosis.nombre}
                          </option>
                        ))}
                      </select>

                      {patientDiagnoses.length === 0 && (
                        <small>
                          El paciente no tiene diagnósticos activos registrados.
                        </small>
                      )}

                      <button
                        type="button"
                        className="clinical-history-add-medication"
                        onClick={handleOpenNewDiagnosis}
                      >
                        + Registrar nuevo diagnóstico
                      </button>
                    </div>

                    {pendingDiagnosis && (
                      <div className="clinical-history-form-field full-width">
                        <div className="clinical-history-success">
                          <strong>Diagnóstico nuevo preparado:</strong>{" "}
                          {pendingDiagnosis.codigoCie10} —{" "}
                          {pendingDiagnosis.nombre}. Se registrará cuando guarde
                          la atención.
                          <button
                            type="button"
                            onClick={handleRemovePendingDiagnosis}
                            style={{
                              marginLeft: "12px",
                            }}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    )}

                    {showNewDiagnosisForm && (
                      <div className="clinical-history-form-field full-width">
                        <div className="clinical-history-new-medication">
                          <div className="clinical-history-new-medication-header">
                            <div>
                              <span>Diagnóstico</span>
                              <h4>Registrar nuevo diagnóstico</h4>
                            </div>
                          </div>

                          <div className="clinical-history-medication-form-grid">
                            <div className="clinical-history-form-field">
                              <label htmlFor="newDiagnosisCode">
                                Código CIE-10 *
                              </label>

                              <input
                                id="newDiagnosisCode"
                                type="text"
                                value={newDiagnosisCode}
                                onChange={(event) =>
                                  setNewDiagnosisCode(
                                    event.target.value.toUpperCase(),
                                  )
                                }
                                placeholder="Ej. I10"
                              />
                            </div>

                            <div className="clinical-history-form-field">
                              <label htmlFor="newDiagnosisName">
                                Nombre del diagnóstico *
                              </label>

                              <input
                                id="newDiagnosisName"
                                type="text"
                                value={newDiagnosisName}
                                onChange={(event) =>
                                  setNewDiagnosisName(event.target.value)
                                }
                                placeholder="Ej. Hipertensión arterial"
                              />
                            </div>

                            <div className="clinical-history-form-field">
                              <label htmlFor="newDiagnosisType">
                                Tipo de diagnóstico *
                              </label>

                              <select
                                id="newDiagnosisType"
                                value={newDiagnosisType}
                                onChange={(event) =>
                                  setNewDiagnosisType(
                                    event.target.value as DiagnosisType,
                                  )
                                }
                              >
                                <option value="AGUDO">Agudo</option>

                                <option value="CRONICO">Crónico</option>

                                <option value="OTRO">Otro</option>
                              </select>
                            </div>

                            <div className="clinical-history-form-field">
                              <label>Requiere esquema de tratamiento</label>

                              <label>
                                <input
                                  type="checkbox"
                                  checked={newDiagnosisRequiresScheme}
                                  onChange={(event) =>
                                    setNewDiagnosisRequiresScheme(
                                      event.target.checked,
                                    )
                                  }
                                />
                                Sí
                              </label>
                            </div>

                            <div className="clinical-history-form-field full-width">
                              <label htmlFor="newDiagnosisObservations">
                                Observaciones
                              </label>

                              <textarea
                                id="newDiagnosisObservations"
                                value={newDiagnosisObservations}
                                onChange={(event) =>
                                  setNewDiagnosisObservations(
                                    event.target.value,
                                  )
                                }
                                placeholder="Observaciones del diagnóstico"
                                rows={2}
                              />
                            </div>
                          </div>

                          {diagnosisError && (
                            <p className="clinical-history-error attention-form-error">
                              {diagnosisError}
                            </p>
                          )}

                          <div className="clinical-history-form-actions">
                            <button
                              type="button"
                              className="clinical-history-cancel-button"
                              onClick={handleCancelNewDiagnosis}
                            >
                              Cancelar
                            </button>

                            <button
                              type="button"
                              className="clinical-history-action-button"
                              onClick={handlePrepareNewDiagnosis}
                            >
                              Usar este diagnóstico
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="clinical-history-form-field">
                      <label htmlFor="vigenciaMeses">Vigencia en meses *</label>

                      <input
                        id="vigenciaMeses"
                        type="number"
                        min="1"
                        step="1"
                        value={vigenciaMeses}
                        onChange={(event) =>
                          setVigenciaMeses(event.target.value)
                        }
                      />
                    </div>

                    <div className="clinical-history-form-field">
                      <label htmlFor="indicaciones">
                        Indicaciones generales
                      </label>

                      <input
                        id="indicaciones"
                        type="text"
                        value={indicaciones}
                        onChange={(event) =>
                          setIndicaciones(event.target.value)
                        }
                        placeholder="Indicaciones de la formulación"
                      />
                    </div>
                  </div>

                  <div className="clinical-history-new-medications">
                    {medicamentos.map((medication, index) => (
                      <div
                        className="clinical-history-new-medication"
                        key={index}
                      >
                        <div className="clinical-history-new-medication-header">
                          <div>
                            <span>Medicamento</span>
                            <h4>Medicamento {index + 1}</h4>
                          </div>

                          {medicamentos.length > 1 && (
                            <button
                              type="button"
                              className="clinical-history-remove-medication"
                              onClick={() => handleRemoveMedication(index)}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>

                        <div className="clinical-history-medication-form-grid">
                          <div className="clinical-history-form-field">
                            <label>Medicamento *</label>

                            <input
                              type="text"
                              value={medication.medicamento}
                              onChange={(event) =>
                                handleMedicationChange(
                                  index,
                                  "medicamento",
                                  event.target.value,
                                )
                              }
                              placeholder="Ej. Dolutegravir"
                            />
                          </div>

                          <div className="clinical-history-form-field">
                            <label>Concentración</label>

                            <input
                              type="text"
                              value={medication.concentracion}
                              onChange={(event) =>
                                handleMedicationChange(
                                  index,
                                  "concentracion",
                                  event.target.value,
                                )
                              }
                              placeholder="Ej. 50 mg"
                            />
                          </div>

                          <div className="clinical-history-form-field">
                            <label>Forma farmacéutica</label>

                            <input
                              type="text"
                              value={medication.formaFarmaceutica}
                              onChange={(event) =>
                                handleMedicationChange(
                                  index,
                                  "formaFarmaceutica",
                                  event.target.value,
                                )
                              }
                              placeholder="Ej. Tableta"
                            />
                          </div>

                          <div className="clinical-history-form-field">
                            <label>Dosis *</label>

                            <input
                              type="text"
                              value={medication.dosis}
                              onChange={(event) =>
                                handleMedicationChange(
                                  index,
                                  "dosis",
                                  event.target.value,
                                )
                              }
                              placeholder="Ej. 1 tableta"
                            />
                          </div>

                          <div className="clinical-history-form-field">
                            <label>Frecuencia *</label>

                            <input
                              type="text"
                              value={medication.frecuencia}
                              onChange={(event) =>
                                handleMedicationChange(
                                  index,
                                  "frecuencia",
                                  event.target.value,
                                )
                              }
                              placeholder="Ej. Cada 24 horas"
                            />
                          </div>

                          <div className="clinical-history-form-field">
                            <label>Duración</label>

                            <input
                              type="text"
                              value={medication.duracion}
                              onChange={(event) =>
                                handleMedicationChange(
                                  index,
                                  "duracion",
                                  event.target.value,
                                )
                              }
                              placeholder="Ej. 30 días"
                            />
                          </div>

                          <div className="clinical-history-form-field">
                            <label>Cantidad *</label>

                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={medication.cantidad}
                              onChange={(event) =>
                                handleMedicationChange(
                                  index,
                                  "cantidad",
                                  event.target.value,
                                )
                              }
                            />
                          </div>

                          <div className="clinical-history-form-field">
                            <label>Vía de administración</label>

                            <input
                              type="text"
                              value={medication.viaAdministracion}
                              onChange={(event) =>
                                handleMedicationChange(
                                  index,
                                  "viaAdministracion",
                                  event.target.value,
                                )
                              }
                              placeholder="Ej. Oral"
                            />
                          </div>

                          <div className="clinical-history-form-field full-width">
                            <label>Observaciones del medicamento</label>

                            <textarea
                              value={medication.observaciones}
                              onChange={(event) =>
                                handleMedicationChange(
                                  index,
                                  "observaciones",
                                  event.target.value,
                                )
                              }
                              placeholder="Observaciones adicionales"
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="clinical-history-add-medication"
                    onClick={handleAddMedication}
                  >
                    + Agregar otro medicamento
                  </button>
                </section>

                {attentionError && (
                  <p className="clinical-history-error attention-form-error">
                    {attentionError}
                  </p>
                )}

                <div className="clinical-history-form-actions">
                  <button
                    type="button"
                    className="clinical-history-cancel-button"
                    onClick={handleCancelAttention}
                    disabled={savingAttention}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="clinical-history-action-button"
                    disabled={savingAttention}
                  >
                    {savingAttention
                      ? "Guardando..."
                      : "Guardar atención y formulación"}
                  </button>
                </div>
              </form>
            )}

            {clinicalAttentions.length === 0 ? (
              <div className="clinical-history-empty">
                <strong>Sin atenciones registradas</strong>

                <p>
                  El paciente todavía no tiene atenciones clínicas registradas.
                </p>
              </div>
            ) : (
              <div className="clinical-history-attentions">
                {clinicalAttentions.map((attention) => (
                  <div
                    key={attention.id}
                    className="clinical-history-attention"
                  >
                    <div>
                      <span>Ingreso</span>
                      <strong>{attention.numeroIngreso}</strong>
                    </div>

                    <div>
                      <span>Fecha</span>
                      <strong>{formatDate(attention.fechaAtencion)}</strong>
                    </div>

                    <div>
                      <span>Profesional</span>
                      <strong>{attention.profesional.nombre}</strong>
                    </div>

                    <div>
                      <span>Rol</span>
                      <strong>{attention.profesional.rol}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
          <article className="clinical-history-card">
            <div className="clinical-history-card-header">
              <div>
                <span>Tratamiento</span>
                <h2>Formulaciones vigentes</h2>
              </div>

              <div className="clinical-history-card-actions">
                <strong className="clinical-history-count">
                  {formulations?.totalFormulacionesVigentes ?? 0}
                </strong>
              </div>
            </div>

            {activeFormulations.length === 0 ? (
              <div className="clinical-history-empty">
                <strong>Sin formulaciones vigentes</strong>

                <p>
                  Actualmente el paciente no tiene formulaciones vigentes
                  registradas.
                </p>
              </div>
            ) : (
              <div className="clinical-history-formulations">
                {activeFormulations.map((formulation) => {
                  const isExpanded = expandedFormulationId === formulation.id;

                  const medicationNames = formulation.medicamentos
                    .map(
                      (medication) =>
                        `${medication.medicamento}${
                          medication.concentracion
                            ? ` ${medication.concentracion}`
                            : ""
                        }`,
                    )
                    .join(", ");

                  return (
                    <div
                      key={formulation.id}
                      className="clinical-history-formulation"
                    >
                      <div className="clinical-history-formulation-summary">
                        <div className="clinical-history-formulation-main">
                          <span>Formulación #{formulation.id}</span>

                          <strong>
                            {medicationNames || "Sin medicamentos registrados"}
                          </strong>

                          <p>
                            {formulation.diagnosticoPaciente?.codigoCie10
                              ? `${formulation.diagnosticoPaciente.codigoCie10} — ${formulation.diagnosticoPaciente.nombre}`
                              : formulation.diagnosticoPaciente?.nombre ||
                                "Sin diagnóstico asociado"}
                          </p>
                        </div>

                        <div className="clinical-history-formulation-meta">
                          <div>
                            <span>Ingreso</span>

                            <strong>
                              {formulation.atencionClinica.numeroIngreso}
                            </strong>
                          </div>

                          <div>
                            <span>Fecha</span>

                            <strong>
                              {formatDate(formulation.fechaFormulacion)}
                            </strong>
                          </div>

                          <div>
                            <span>Vigencia</span>

                            <strong>
                              {formulation.vigenciaMeses}{" "}
                              {formulation.vigenciaMeses === 1
                                ? "mes"
                                : "meses"}
                            </strong>
                          </div>

                          <div>
                            <span>Estado</span>

                            <strong className="clinical-history-status">
                              {formulation.estado}
                            </strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="clinical-history-detail-button"
                          onClick={() => toggleFormulation(formulation.id)}
                        >
                          {isExpanded ? "Ocultar detalle" : "Ver detalle"}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="clinical-history-formulation-detail">
                          <div className="clinical-history-detail-grid">
                            <div>
                              <span>Profesional</span>

                              <p>
                                {formulation.atencionClinica.profesional.nombre}
                              </p>
                            </div>

                            <div>
                              <span>Rol</span>

                              <p>
                                {formulation.atencionClinica.profesional.rol}
                              </p>
                            </div>

                            <div>
                              <span>Fecha de atención</span>

                              <p>
                                {formatDate(
                                  formulation.atencionClinica.fechaAtencion,
                                )}
                              </p>
                            </div>

                            <div>
                              <span>Fecha de vencimiento</span>

                              <p>{formatDate(formulation.fechaVencimiento)}</p>
                            </div>
                          </div>

                          {formulation.diagnosticoPaciente && (
                            <div className="clinical-history-detail-block">
                              <span>Diagnóstico asociado</span>

                              <p>
                                {formulation.diagnosticoPaciente.nombre}

                                {formulation.diagnosticoPaciente.codigoCie10
                                  ? ` (${formulation.diagnosticoPaciente.codigoCie10})`
                                  : ""}
                              </p>
                            </div>
                          )}

                          <div className="clinical-history-detail-block">
                            <span>Indicaciones</span>

                            <p>
                              {formulation.indicaciones ||
                                "Sin indicaciones registradas"}
                            </p>
                          </div>

                          <div className="clinical-history-medications">
                            <span className="clinical-history-medications-title">
                              Medicamentos
                            </span>

                            {formulation.medicamentos.map((medication) => (
                              <div
                                key={medication.id}
                                className="clinical-history-medication"
                              >
                                <strong>
                                  {medication.medicamento}

                                  {medication.concentracion
                                    ? ` ${medication.concentracion}`
                                    : ""}
                                </strong>

                                <div className="clinical-history-medication-grid">
                                  <div>
                                    <span>Forma</span>

                                    <p>
                                      {medication.formaFarmaceutica ||
                                        "No registrada"}
                                    </p>
                                  </div>

                                  <div>
                                    <span>Dosis</span>
                                    <p>{medication.dosis}</p>
                                  </div>

                                  <div>
                                    <span>Frecuencia</span>
                                    <p>{medication.frecuencia}</p>
                                  </div>

                                  <div>
                                    <span>Cantidad</span>
                                    <p>{medication.cantidad}</p>
                                  </div>

                                  <div>
                                    <span>Duración</span>

                                    <p>
                                      {medication.duracion || "No registrada"}
                                    </p>
                                  </div>

                                  <div>
                                    <span>Vía</span>

                                    <p>
                                      {medication.viaAdministracion ||
                                        "No registrada"}
                                    </p>
                                  </div>
                                </div>

                                {medication.observaciones && (
                                  <div className="clinical-history-medication-observation">
                                    <span>Observaciones</span>

                                    <p>{medication.observaciones}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}

export default ClinicalHistory;
