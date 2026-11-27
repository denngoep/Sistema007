import DispensationDocuments from "../components/DispensationDocuments";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

import {
  getPatientMedications,
  validateDispensation,
  createDispensation,
  generateDispensationReceipt,
  pendingDispensation,
  recoverDispensation,
} from "../services/dispensations.service";

import type {
  PatientMedicationsResponse,
  DispensationMedication,
  DispensationFormulation,
  ValidateDispensationResponse,
  CreateDispensationResponse,
  DispensationReceiptResponse,
} from "../services/dispensations.service";

import { getInventoryWarehouses } from "../services/inventory.service";

import type { InventoryWarehouseOption } from "../services/inventory.service";

import "../styles/Inventory.css";

type SelectedMedication = {
  formulacion: DispensationFormulation;
  medicamento: DispensationMedication;
};

type ConfirmedDispensation = {
  id: number;
  numeroDispensacion: string;
  fechaDispensacion: string;
  estado: string;
  medicamento: string;
  concentracion: string;
  cantidad: number;
  bodega: string;
};

const cardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dce5ed",
  borderRadius: 12,
  padding: 20,
  marginTop: 18,
};

const fieldStyle: CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid #dce5ed",
  borderRadius: 8,
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontWeight: 600,
  marginBottom: 8,
  color: "#062b55",
};

const tableCellStyle: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #e4eaf0",
  textAlign: "left",
  verticalAlign: "top",
};

const primaryButtonStyle: CSSProperties = {
  background: "#062b55",
  color: "#ffffff",
  border: "none",
  borderRadius: 8,
  padding: "12px 20px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  background: "#00aebc",
  color: "#ffffff",
  border: "none",
  borderRadius: 8,
  padding: "12px 20px",
  fontWeight: 600,
  cursor: "pointer",
};

function formatDate(value?: string | null): string {
  if (!value) return "No registrada";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Dispensations() {
  const navigate = useNavigate();
  const isAdministrator = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}").rol === "ADMINISTRADOR";
    } catch {
      return false;
    }
  })();

  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [resultado, setResultado] = useState<PatientMedicationsResponse | null>(
    null,
  );

  const [bodegas, setBodegas] = useState<InventoryWarehouseOption[]>([]);

  const [errorBodegas, setErrorBodegas] = useState("");
  const [cargandoBodegas, setCargandoBodegas] = useState(true);

  const [seleccion, setSeleccion] = useState<SelectedMedication | null>(null);

  const [bodegaId, setBodegaId] = useState("");
  const [cantidad, setCantidad] = useState("");

  const [validando, setValidando] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState("");

  const [validacion, setValidacion] =
    useState<ValidateDispensationResponse | null>(null);

  const [confirmando, setConfirmando] = useState(false);
  const [errorRegistro, setErrorRegistro] = useState("");

  const [dispensacionConfirmada, setDispensacionConfirmada] =
    useState<ConfirmedDispensation | null>(null);

  const [generandoComprobante, setGenerandoComprobante] = useState(false);

  const [errorComprobante, setErrorComprobante] = useState("");

  const [comprobante, setComprobante] = useState<
    DispensationReceiptResponse["comprobante"] | null
  >(null);

  const [recuperandoEntrega, setRecuperandoEntrega] = useState(
    () => pendingDispensation() !== null,
  );

  // Evita solicitudes simultáneas de registro.
  const registroEnProceso = useRef(false);

  // Conserva los datos exactos que fueron validados.
  const [datosValidados, setDatosValidados] = useState<{
    numeroDocumento: string;
    formulacionId: number;
    detalleFormulacionId: number;
    cantidad: number;
    bodegaId: number;
  } | null>(null);

  useEffect(() => {
    let activo = true;

    async function cargarBodegas() {
      try {
        const data = await getInventoryWarehouses();

        if (!activo) return;

        setBodegas(data.filter((bodega) => bodega.permiteDispensacion));
      } catch (err) {
        if (!activo) return;

        setErrorBodegas(
          err instanceof Error
            ? err.message
            : "No fue posible consultar las bodegas.",
        );
      } finally {
        if (activo) {
          setCargandoBodegas(false);
        }
      }
    }

    void cargarBodegas();

    return () => {
      activo = false;
    };
  }, []);

  function limpiarValidacion() {
    setValidacion(null);
    setDatosValidados(null);
    setErrorValidacion("");
    setErrorRegistro("");
  }

  function limpiarSeleccion() {
    setSeleccion(null);
    setBodegaId("");
    setCantidad("");
    limpiarValidacion();
  }

  function limpiarRegistro() {
    setDispensacionConfirmada(null);
    setComprobante(null);
    setErrorComprobante("");
    setErrorRegistro("");
  }

  async function buscarPaciente(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const documento = numeroDocumento.trim();

    if (!documento || loading || confirmando) return;

    setLoading(true);
    setError("");
    setResultado(null);

    limpiarSeleccion();
    limpiarRegistro();

    try {
      const data = await getPatientMedications(documento);
      setResultado(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible consultar las formulaciones del paciente.",
      );
    } finally {
      setLoading(false);
    }
  }

  function seleccionarMedicamento(
    formulacion: DispensationFormulation,
    medicamento: DispensationMedication,
  ) {
    if (isAdministrator) {
      setErrorValidacion("La validación de una entrega requiere un profesional farmacéutico autorizado.");
      return;
    }
    if (confirmando) return;

    setSeleccion({
      formulacion,
      medicamento,
    });

    setCantidad(String(medicamento.cantidadPendiente));
    setBodegaId("");

    limpiarValidacion();
    limpiarRegistro();
  }

  async function validarMedicamento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !resultado ||
      !seleccion ||
      validando ||
      confirmando ||
      dispensacionConfirmada
    ) {
      return;
    }

    const cantidadNumerica = Number(cantidad);
    const bodegaNumerica = Number(bodegaId);

    if (
      !Number.isInteger(cantidadNumerica) ||
      cantidadNumerica < 1 ||
      cantidadNumerica > seleccion.medicamento.cantidadPendiente
    ) {
      setErrorValidacion(
        "La cantidad debe ser un número entero entre 1 y la cantidad pendiente.",
      );

      setValidacion(null);
      setDatosValidados(null);
      return;
    }

    if (!Number.isInteger(bodegaNumerica) || bodegaNumerica < 1) {
      setErrorValidacion("Debes seleccionar una bodega válida.");

      setValidacion(null);
      setDatosValidados(null);
      return;
    }

    const solicitud = {
      numeroDocumento: resultado.paciente.numeroDocumento,
      formulacionId: seleccion.formulacion.formulacionId,
      detalleFormulacionId: seleccion.medicamento.detalleFormulacionId,
      cantidad: cantidadNumerica,
      bodegaId: bodegaNumerica,
    };

    setValidando(true);
    setErrorValidacion("");
    setErrorRegistro("");
    setValidacion(null);
    setDatosValidados(null);

    try {
      const data = await validateDispensation(solicitud);

      if (!data.valida) {
        setErrorValidacion(data.mensaje || "La dispensación no fue validada.");
        return;
      }

      setValidacion(data);
      setDatosValidados(solicitud);
    } catch (err) {
      setErrorValidacion(
        err instanceof Error
          ? err.message
          : "No fue posible validar la dispensación.",
      );
    } finally {
      setValidando(false);
    }
  }

  async function confirmarDispensacion() {
    if (isAdministrator) {
      setErrorRegistro("La dispensación requiere un profesional farmacéutico autorizado.");
      return;
    }
    if (
      !resultado ||
      !seleccion ||
      !validacion?.valida ||
      !datosValidados ||
      confirmando ||
      registroEnProceso.current ||
      dispensacionConfirmada
    ) {
      return;
    }

    const confirmado = window.confirm(
      `¿Confirmas la dispensación de ${datosValidados.cantidad} unidad(es) de ${seleccion.medicamento.medicamento} al paciente ${resultado.paciente.nombres} ${resultado.paciente.apellidos}?\n\nEsta operación registrará la entrega y descontará las existencias del inventario.`,
    );

    if (!confirmado) return;

    registroEnProceso.current = true;
    setConfirmando(true);
    setErrorRegistro("");

    try {
      const respuesta: CreateDispensationResponse =
        await createDispensation(datosValidados);

      if (!respuesta.registrada) {
        throw new Error(
          respuesta.mensaje || "No se confirmó el registro de la dispensación.",
        );
      }

      const registro = respuesta.dispensacion;

      if (!Number.isInteger(registro.id) || registro.id <= 0) {
        throw new Error(
          "El servidor respondió sin un identificador válido de dispensación. Verifica el registro antes de intentar nuevamente.",
        );
      }

      setDispensacionConfirmada({
        id: registro.id,
        numeroDispensacion: registro.numeroDispensacion,
        fechaDispensacion: registro.fechaDispensacion,
        estado: registro.estado,
        medicamento: seleccion.medicamento.medicamento,
        concentracion: seleccion.medicamento.concentracion,
        cantidad: datosValidados.cantidad,
        bodega: validacion.inventario.bodega,
      });

      setValidacion(null);
      setDatosValidados(null);
      try { setResultado(await getPatientMedications(resultado.paciente.numeroDocumento)); }
      catch { setError('Entrega confirmada. Actualiza la consulta para obtener los saldos actuales.'); }
    } catch (err) {
      setErrorRegistro(
        err instanceof Error
          ? err.message
          : "No fue posible registrar la dispensación. Verifica el resultado antes de volver a intentar.",
      );
    } finally {
      registroEnProceso.current = false;
      setConfirmando(false);
    }
  }

  async function generarComprobante() {
    if (isAdministrator) {
      setErrorComprobante("La generación del comprobante requiere un profesional farmacéutico autorizado.");
      return;
    }
    if (!dispensacionConfirmada || generandoComprobante || comprobante) {
      return;
    }

    setGenerandoComprobante(true);
    setErrorComprobante("");

    try {
      const respuesta: DispensationReceiptResponse =
        await generateDispensationReceipt(dispensacionConfirmada.id);

      if (!respuesta.generado) {
        throw new Error(
          respuesta.mensaje || "No fue posible generar el comprobante.",
        );
      }

      setComprobante(respuesta.comprobante);
    } catch (err) {
      setErrorComprobante(
        err instanceof Error
          ? err.message
          : "No fue posible generar el comprobante.",
      );
    } finally {
      setGenerandoComprobante(false);
    }
  }

  async function recuperarEntregaPendiente() {
    if (confirmando) return;
    setConfirmando(true);
    setErrorRegistro("");
    try {
      const respuesta = await recoverDispensation();
      if (!respuesta) {
        setRecuperandoEntrega(false);
        return;
      }
      setDispensacionConfirmada({
        id: respuesta.dispensacion.id,
        numeroDispensacion: respuesta.dispensacion.numeroDispensacion,
        fechaDispensacion: respuesta.dispensacion.fechaDispensacion,
        estado: respuesta.dispensacion.estado,
        medicamento: "Entrega recuperada",
        concentracion: "",
        cantidad: 0,
        bodega: "Consulta el historial para ver el detalle",
      });
      setRecuperandoEntrega(false);
      setErrorRegistro("La entrega anterior fue recuperada sin realizar un nuevo descuento.");
    } catch (err) {
      setErrorRegistro(
        err instanceof Error
          ? err.message
          : "No fue posible recuperar la entrega pendiente.",
      );
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <main className="inventory-page">
      <header className="inventory-header">
        <div>
          <span className="inventory-section-label">
            SISTEMA 007 / DISPENSACIÓN
          </span>

          <h1>Dispensación de medicamentos</h1>

          <p>
            Consulta formulaciones vigentes, valida existencias, registra
            entregas y genera comprobantes de dispensación.
          </p>
        </div>

        <button
          type="button"
          className="inventory-back-button"
          onClick={() => navigate("/dashboard")}
          disabled={confirmando}
        >
          Volver al panel
        </button>
      </header>

      <DispensationDocuments confirmedId={dispensacionConfirmada?.id} readOnly={isAdministrator} />
      {isAdministrator && (
        <p className="inventory-message" role="status">
          Modo de supervisión administrativa: puedes consultar entregas y soportes, pero la dispensación y sus actos documentales requieren un profesional farmacéutico autorizado.
        </p>
      )}
      <section className="inventory-content">
        {recuperandoEntrega && (
          <div className="inventory-message" style={{ marginBottom: 16 }}>
            Hay una entrega cuya respuesta anterior no se confirmó en este navegador.
            <button
              type="button"
              className="inventory-receipt-submit"
              style={{ marginLeft: 12 }}
              disabled={confirmando}
              onClick={() => void recuperarEntregaPendiente()}
            >
              Recuperar entrega
            </button>
          </div>
        )}
        <div className="inventory-toolbar">
          <div>
            <h2>Buscar paciente</h2>
            <span>
              Ingresa el número de documento para consultar sus formulaciones.
            </span>
          </div>
        </div>

        <form onSubmit={buscarPaciente}>
          <div className="inventory-search-container">
            <label htmlFor="numeroDocumento">Número de documento</label>

            <input
              id="numeroDocumento"
              type="text"
              value={numeroDocumento}
              onChange={(event) => {
                setNumeroDocumento(event.target.value);
                setError("");
                setResultado(null);

                limpiarSeleccion();
                limpiarRegistro();
              }}
              placeholder="Ingrese el documento del paciente"
              autoComplete="off"
              disabled={confirmando}
              required
            />
          </div>

          <div style={{ marginTop: 18 }}>
            <button
              type="submit"
              className="inventory-receipt-submit"
              disabled={!numeroDocumento.trim() || loading || confirmando}
            >
              {loading ? "Consultando..." : "Buscar paciente"}
            </button>
          </div>
        </form>

        {error && (
          <div
            className="inventory-message"
            role="alert"
            style={{ marginTop: 20 }}
          >
            {error}
          </div>
        )}

        {resultado && (
          <>
            <section style={cardStyle}>
              <h2>Información del paciente</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                  marginTop: 16,
                }}
              >
                <div>
                  <strong>Nombre completo</strong>
                  <p>
                    {resultado.paciente.nombres} {resultado.paciente.apellidos}
                  </p>
                </div>

                <div>
                  <strong>Documento</strong>
                  <p>
                    {resultado.paciente.tipoDocumento}{" "}
                    {resultado.paciente.numeroDocumento}
                  </p>
                </div>

                <div>
                  <strong>Formulaciones vigentes</strong>
                  <p>{resultado.totalFormulacionesVigentes}</p>
                </div>

                <div>
                  <strong>Medicamentos formulados</strong>
                  <p>{resultado.totalMedicamentos}</p>
                </div>
              </div>

              {resultado.informacionClinica.alergias && (
                <div
                  role="status"
                  style={{
                    marginTop: 16,
                    padding: 14,
                    background: "#fff5e6",
                    border: "1px solid #eacb91",
                    borderRadius: 8,
                  }}
                >
                  <strong>Alergias registradas:</strong>{" "}
                  {resultado.informacionClinica.alergias}
                </div>
              )}
            </section>

            <section style={{ marginTop: 28 }}>
              <h2>Formulaciones médicas vigentes</h2>

              {resultado.formulacionesVigentes.length === 0 ? (
                <div className="inventory-message" style={{ marginTop: 16 }}>
                  El paciente no tiene formulaciones vigentes para dispensación.
                </div>
              ) : (
                resultado.formulacionesVigentes.map((formulacion) => (
                  <article key={formulacion.formulacionId} style={cardStyle}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <h3>Formulación #{formulacion.formulacionId}</h3>

                        <p>
                          <strong>Ingreso clínico:</strong>{" "}
                          {formulacion.atencion.numeroIngreso}
                        </p>

                        <p>
                          <strong>Diagnóstico:</strong>{" "}
                          {formulacion.diagnostico
                            ? `${formulacion.diagnostico.nombre} (${formulacion.diagnostico.codigoCie10 ?? "Sin CIE-10"})`
                            : "No registrado"}
                        </p>

                        <p>
                          <strong>Profesional:</strong>{" "}
                          {formulacion.atencion.profesional.nombre}
                        </p>
                      </div>

                      <div>
                        <p>
                          <strong>Fecha de formulación:</strong>{" "}
                          {formatDate(formulacion.fechaFormulacion)}
                        </p>

                        <p>
                          <strong>Vigente hasta:</strong>{" "}
                          {formatDate(formulacion.fechaFinVigencia)}
                        </p>

                        <p>
                          <strong>Estado:</strong> {formulacion.estado}
                        </p>
                      </div>
                    </div>

                    {formulacion.indicaciones && (
                      <p style={{ marginTop: 12 }}>
                        <strong>Indicaciones:</strong>{" "}
                        {formulacion.indicaciones}
                      </p>
                    )}

                    <div
                      style={{
                        overflowX: "auto",
                        marginTop: 20,
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          minWidth: 850,
                        }}
                      >
                        <thead
                          style={{
                            background: "#f3f6f9",
                          }}
                        >
                          <tr>
                            <th style={tableCellStyle}>Medicamento</th>
                            <th style={tableCellStyle}>Concentración</th>
                            <th style={tableCellStyle}>Forma</th>
                            <th style={tableCellStyle}>Posología</th>
                            <th style={tableCellStyle}>Formulada / entregada / pendiente</th>
                            <th style={tableCellStyle}>Acción</th>
                          </tr>
                        </thead>

                        <tbody>
                          {formulacion.medicamentos.map((medicamento) => (
                            <tr key={medicamento.detalleFormulacionId}>
                              <td style={tableCellStyle}>
                                <strong>{medicamento.medicamento}</strong>

                                <div
                                  style={{
                                    fontSize: 13,
                                    marginTop: 4,
                                  }}
                                >
                                  Vía: {medicamento.viaAdministracion}
                                </div>
                              </td>

                              <td style={tableCellStyle}>
                                {medicamento.concentracion}
                              </td>

                              <td style={tableCellStyle}>
                                {medicamento.formaFarmaceutica}
                              </td>

                              <td style={tableCellStyle}>
                                <div>Dosis: {medicamento.dosis}</div>

                                <div>Frecuencia: {medicamento.frecuencia}</div>

                                <div>Duración: {medicamento.duracion}</div>
                              </td>

                              <td style={tableCellStyle}>
                                {medicamento.cantidadFormulada} / {medicamento.cantidadEntregada} / {medicamento.cantidadPendiente}
                              </td>

                              <td style={tableCellStyle}>
                                <button
                                  type="button"
                                  className="inventory-receipt-submit"
                                  disabled={confirmando || medicamento.cantidadPendiente <= 0}
                                  onClick={() =>
                                    seleccionarMedicamento(
                                      formulacion,
                                      medicamento,
                                    )
                                  }
                                >
                                  Seleccionar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))
              )}
            </section>

            {seleccion && (
              <section style={cardStyle}>
                <h2>Validar medicamento para dispensación</h2>

                <p style={{ marginTop: 12 }}>
                  <strong>Medicamento:</strong>{" "}
                  {seleccion.medicamento.medicamento}{" "}
                  {seleccion.medicamento.concentracion}
                </p>

                <p>
                  <strong>Cantidad formulada:</strong>{" "}
                  {seleccion.medicamento.cantidad}
                </p>

                {!dispensacionConfirmada && (
                  <form onSubmit={validarMedicamento} style={{ marginTop: 20 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(240px, 1fr))",
                        gap: 20,
                      }}
                    >
                      <div>
                        <label htmlFor="bodegaId" style={labelStyle}>
                          Bodega de dispensación
                        </label>

                        <select
                          id="bodegaId"
                          value={bodegaId}
                          onChange={(event) => {
                            setBodegaId(event.target.value);
                            limpiarValidacion();
                          }}
                          style={fieldStyle}
                          disabled={validando || confirmando}
                          required
                        >
                          <option value="">Seleccione una bodega</option>

                          {bodegas.map((bodega) => (
                            <option key={bodega.id} value={bodega.id}>
                              {bodega.nombre} — {bodega.sede.nombre}
                            </option>
                          ))}
                        </select>

                        {cargandoBodegas && <p>Consultando bodegas...</p>}

                        {errorBodegas && (
                          <p
                            role="alert"
                            style={{
                              color: "#b42318",
                            }}
                          >
                            {errorBodegas}
                          </p>
                        )}

                        {!cargandoBodegas &&
                          !errorBodegas &&
                          bodegas.length === 0 && (
                            <p>No hay bodegas habilitadas para dispensación.</p>
                          )}
                      </div>

                      <div>
                        <label htmlFor="cantidad" style={labelStyle}>
                          Cantidad a dispensar
                        </label>

                        <input
                          id="cantidad"
                          type="number"
                          min={1}
                          max={seleccion.medicamento.cantidadPendiente}
                          step={1}
                          value={cantidad}
                          onChange={(event) => {
                            setCantidad(event.target.value);
                            limpiarValidacion();
                          }}
                          style={fieldStyle}
                          disabled={validando || confirmando}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="inventory-receipt-submit"
                      disabled={
                        validando ||
                        confirmando ||
                        !bodegaId ||
                        !cantidad ||
                        cargandoBodegas ||
                        Boolean(errorBodegas)
                      }
                      style={{ marginTop: 20 }}
                    >
                      {validando
                        ? "Validando existencias..."
                        : "Validar dispensación"}
                    </button>
                  </form>
                )}

                {errorValidacion && (
                  <div
                    className="inventory-message"
                    role="alert"
                    style={{ marginTop: 20 }}
                  >
                    {errorValidacion}
                  </div>
                )}

                {validacion && !dispensacionConfirmada && (
                  <div
                    style={{
                      ...cardStyle,
                      background: "#f5fafb",
                    }}
                  >
                    <h3>Resultado de la validación</h3>

                    <p style={{ marginTop: 12 }}>
                      <strong>Resultado:</strong> {validacion.mensaje}
                    </p>

                    <p>
                      <strong>Bodega:</strong> {validacion.inventario.bodega}
                    </p>

                    <p>
                      <strong>Sede:</strong> {validacion.inventario.sede}
                    </p>

                    <p>
                      <strong>Existencias disponibles:</strong>{" "}
                      {validacion.inventario.stockDisponible}
                    </p>

                    <p>
                      <strong>Cantidad solicitada:</strong>{" "}
                      {validacion.medicamento.cantidadAValidar}
                    </p>

                    <h4 style={{ marginTop: 20 }}>
                      Lotes sugeridos para dispensación
                    </h4>

                    <div
                      style={{
                        overflowX: "auto",
                        marginTop: 12,
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          minWidth: 600,
                        }}
                      >
                        <thead
                          style={{
                            background: "#eaf1f5",
                          }}
                        >
                          <tr>
                            <th style={tableCellStyle}>Lote</th>
                            <th style={tableCellStyle}>Vencimiento</th>
                            <th style={tableCellStyle}>Disponible</th>
                            <th style={tableCellStyle}>Sugerido</th>
                          </tr>
                        </thead>

                        <tbody>
                          {validacion.inventario.lotesSugeridos.map((lote) => (
                            <tr key={lote.existenciaId}>
                              <td style={tableCellStyle}>{lote.numeroLote}</td>

                              <td style={tableCellStyle}>
                                {formatDate(lote.fechaVencimiento)}
                              </td>

                              <td style={tableCellStyle}>
                                {lote.cantidadDisponible}
                              </td>

                              <td style={tableCellStyle}>
                                {lote.cantidadSugerida}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div
                      style={{
                        marginTop: 22,
                        padding: 16,
                        background: "#fff5e6",
                        border: "1px solid #eacb91",
                        borderRadius: 8,
                      }}
                    >
                      <strong>Confirmación de entrega</strong>

                      <p style={{ marginTop: 10 }}>
                        La validación fue satisfactoria. Al confirmar, se
                        registrará la dispensación y se descontará la cantidad
                        entregada del inventario.
                      </p>

                      <p>
                        Verifica el paciente, medicamento, cantidad y bodega
                        antes de continuar.
                      </p>

                      <button
                        type="button"
                        style={primaryButtonStyle}
                        onClick={() => void confirmarDispensacion()}
                        disabled={confirmando || !datosValidados}
                      >
                        {confirmando
                          ? "Registrando dispensación..."
                          : "Confirmar dispensación"}
                      </button>
                    </div>
                  </div>
                )}

                {errorRegistro && (
                  <div
                    className="inventory-message"
                    role="alert"
                    style={{ marginTop: 20 }}
                  >
                    {errorRegistro}
                  </div>
                )}

                {dispensacionConfirmada && (
                  <section
                    style={{
                      ...cardStyle,
                      border: "1px solid #00aebc",
                      background: "#f3fbfc",
                    }}
                  >
                    <h3>Dispensación registrada correctamente</h3>

                    <p style={{ marginTop: 14 }}>
                      <strong>Número de dispensación:</strong>{" "}
                      {dispensacionConfirmada.numeroDispensacion}
                    </p>

                    <p>
                      <strong>Estado:</strong> {dispensacionConfirmada.estado}
                    </p>

                    <p>
                      <strong>Fecha:</strong>{" "}
                      {formatDate(dispensacionConfirmada.fechaDispensacion)}
                    </p>

                    <p>
                      <strong>Medicamento:</strong>{" "}
                      {dispensacionConfirmada.medicamento}{" "}
                      {dispensacionConfirmada.concentracion}
                    </p>

                    <p>
                      <strong>Cantidad entregada:</strong>{" "}
                      {dispensacionConfirmada.cantidad}
                    </p>

                    <p>
                      <strong>Bodega:</strong> {dispensacionConfirmada.bodega}
                    </p>

                    <p
                      style={{
                        marginTop: 14,
                        color: "#52677c",
                      }}
                    >
                      La entrega fue confirmada por el servidor. El inventario
                      se actualizó y quedó registrado el movimiento
                      correspondiente.
                    </p>

                    {!comprobante && (
                      <button
                        type="button"
                        style={{
                          ...secondaryButtonStyle,
                          marginTop: 16,
                        }}
                        onClick={() => void generarComprobante()}
                        disabled={generandoComprobante}
                      >
                        {generandoComprobante
                          ? "Generando comprobante..."
                          : "Generar comprobante"}
                      </button>
                    )}

                    {errorComprobante && (
                      <div
                        className="inventory-message"
                        role="alert"
                        style={{ marginTop: 18 }}
                      >
                        {errorComprobante}
                      </div>
                    )}
                  </section>
                )}

                {comprobante && (
                  <section style={cardStyle}>
                    <div
                      style={{
                        borderBottom: "2px solid #00aebc",
                        paddingBottom: 14,
                        marginBottom: 20,
                      }}
                    >
                      <span
                        style={{
                          color: "#00aebc",
                          fontWeight: 700,
                          letterSpacing: 1,
                        }}
                      >
                        SISTEMA 007
                      </span>

                      <h2
                        style={{
                          color: "#062b55",
                          marginTop: 8,
                        }}
                      >
                        Comprobante de dispensación
                      </h2>
                    </div>

                    <p>
                      <strong>Número de comprobante:</strong>{" "}
                      {comprobante.numeroComprobante}
                    </p>

                    <p>
                      <strong>Fecha del comprobante:</strong>{" "}
                      {formatDate(comprobante.fechaComprobante)}
                    </p>

                    <p>
                      <strong>Número de dispensación:</strong>{" "}
                      {comprobante.numeroDispensacion}
                    </p>

                    <h3 style={{ marginTop: 22 }}>Datos del paciente</h3>

                    <p>
                      <strong>Nombre:</strong> {comprobante.paciente.nombres}{" "}
                      {comprobante.paciente.apellidos}
                    </p>

                    <p>
                      <strong>Documento:</strong>{" "}
                      {comprobante.paciente.tipoDocumento}{" "}
                      {comprobante.paciente.numeroDocumento}
                    </p>

                    <h3 style={{ marginTop: 22 }}>Información de entrega</h3>

                    <p>
                      <strong>Sede:</strong> {comprobante.sede}
                    </p>

                    <p>
                      <strong>Bodega:</strong> {comprobante.bodega}
                    </p>

                    <p>
                      <strong>Responsable de dispensación:</strong>{" "}
                      {comprobante.dispensadoPor.nombre}
                    </p>

                    <h3 style={{ marginTop: 22 }}>Medicamentos entregados</h3>

                    <div
                      style={{
                        overflowX: "auto",
                        marginTop: 14,
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          minWidth: 650,
                        }}
                      >
                        <thead
                          style={{
                            background: "#f3f6f9",
                          }}
                        >
                          <tr>
                            <th style={tableCellStyle}>Medicamento</th>
                            <th style={tableCellStyle}>Concentración</th>
                            <th style={tableCellStyle}>Cantidad</th>
                            <th style={tableCellStyle}>Lote</th>
                            <th style={tableCellStyle}>Vencimiento</th>
                          </tr>
                        </thead>

                        <tbody>
                          {comprobante.medicamentos.map(
                            (medicamento, index) => (
                              <tr key={`${medicamento.numeroLote}-${index}`}>
                                <td style={tableCellStyle}>
                                  {medicamento.medicamento}
                                </td>

                                <td style={tableCellStyle}>
                                  {medicamento.concentracion}
                                </td>

                                <td style={tableCellStyle}>
                                  {medicamento.cantidadEntregada}
                                </td>

                                <td style={tableCellStyle}>
                                  {medicamento.numeroLote}
                                </td>

                                <td style={tableCellStyle}>
                                  {formatDate(medicamento.fechaVencimiento)}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div
                      style={{
                        marginTop: 22,
                        padding: 14,
                        borderRadius: 8,
                        background: "#f3f6f9",
                      }}
                    >
                      <strong>Comprobante generado</strong>

                      <p style={{ marginTop: 8 }}>
                        El comprobante quedó registrado en el sistema. La
                        descarga y el registro de firma del paciente se
                        incorporarán en la siguiente etapa.
                      </p>
                    </div>
                  </section>
                )}
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default Dispensations;
