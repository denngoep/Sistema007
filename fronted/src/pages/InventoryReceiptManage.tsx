import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getInventoryReceiptById,
  updateInventoryReceipt,
  reviewInventoryReceipt,
  reevaluateInventoryReceipt,
  correctInventoryReceiptVerification,
  correctInventoryReceiptDetail,
  downloadInventoryDocument,
  getInventoryReceiptDocuments,
  uploadInventoryReceiptCorrectionSupport,
  uploadInventoryReceiptInvoice,
  type InventoryDocument,
  type InventoryReceiptFullDetail,
  type InventoryReceiptFullDetailItem,
  type InventoryInvimaStatus,
  type CorrectInventoryReceiptDetail,
} from "../services/inventory.service";
import "../styles/InventoryReceipts.css";
import "../styles/InventoryReceiptManage.css";

type ReviewResult = "CONFORME" | "NO_CONFORME";
type Tab = "general" | "productos" | "auditoria";
type ReceiptDetail = InventoryReceiptFullDetail & {
  numeroOrdenCompra?: string | null;
  numeroRemision?: string | null;
};

const inventoryDocumentsEnabled =
  import.meta.env.VITE_INVENTORY_DOCUMENTS_ENABLED === "true";

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin fecha"
    : date.toLocaleDateString("es-CO", { timeZone: "UTC" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin fecha"
    : date.toLocaleString("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function displayStatus(value?: string | null) {
  return value?.replaceAll("_", " ") ?? "Sin registro";
}

function displayValue(value?: string | number | null) {
  return value === null || value === undefined || value === ""
    ? "Sin registro"
    : String(value);
}

function numberOrNull(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

export default function InventoryReceiptManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const receiptId = Number(id);

  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("productos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceDocuments, setInvoiceDocuments] = useState<InventoryDocument[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const [form, setForm] = useState({
    numeroFactura: "",
    fechaFactura: "",
    numeroOrdenCompra: "",
    numeroRemision: "",
    observaciones: "",
  });

  // Revisión inicial
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [result, setResult] = useState<ReviewResult>("CONFORME");
  const [invimaStatus, setInvimaStatus] =
    useState<InventoryInvimaStatus>("VIGENTE");
  const [temperature, setTemperature] = useState("");
  const [humidity, setHumidity] = useState("");
  const [observations, setObservations] = useState("");

  // Reevaluación
  const [reevaluatingId, setReevaluatingId] = useState<number | null>(null);
  const [reevaluationInvima, setReevaluationInvima] =
    useState<InventoryInvimaStatus>("VIGENTE");
  const [reevaluationReason, setReevaluationReason] = useState("");
  const [reevaluationReference, setReevaluationReference] = useState("");
  const [reevaluationNotes, setReevaluationNotes] = useState("");

  // Corrección de verificación
  const [correctingId, setCorrectingId] = useState<number | null>(null);
  const [correctionInvima, setCorrectionInvima] =
    useState<InventoryInvimaStatus>("VIGENTE");
  const [correctionTemperature, setCorrectionTemperature] = useState("");
  const [correctionHumidity, setCorrectionHumidity] = useState("");
  const [correctionObservations, setCorrectionObservations] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionReference, setCorrectionReference] = useState("");

  // Corrección de datos recibidos
  const [correctingProductId, setCorrectingProductId] = useState<number | null>(
    null,
  );
  const [productLot, setProductLot] = useState("");
  const [productExpiration, setProductExpiration] = useState("");
  const [productQuantity, setProductQuantity] = useState("");
  const [productReason, setProductReason] = useState("");
  const [productReference, setProductReference] = useState("");
  const [productSupport, setProductSupport] = useState<File | null>(null);
  const [pendingCorrectionId, setPendingCorrectionId] = useState<number | null>(null);

  const [auditDetailId, setAuditDetailId] = useState<number | null>(null);

  function applyReceipt(data: ReceiptDetail) {
    setReceipt(data);
    setForm({
      numeroFactura: data.numeroFactura ?? "",
      fechaFactura: data.fechaFactura?.slice(0, 10) ?? "",
      numeroOrdenCompra: data.numeroOrdenCompra ?? "",
      numeroRemision: data.numeroRemision ?? "",
      observaciones: data.observaciones ?? "",
    });
  }

  useEffect(() => {
    let active = true;

    async function load() {
      if (!Number.isInteger(receiptId) || receiptId <= 0) {
        setError("Identificador de recepción inválido.");
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [data, documents] = await Promise.all([
          getInventoryReceiptById(receiptId),
          inventoryDocumentsEnabled
            ? getInventoryReceiptDocuments(receiptId)
            : Promise.resolve([]),
        ]);
        if (active) {
          applyReceipt(data);
          setInvoiceDocuments(documents);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "No fue posible cargar la recepción",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [receiptId]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function closeTechnicalForms() {
    setReviewingId(null);
    setReevaluatingId(null);
    setCorrectingId(null);
    setCorrectingProductId(null);
  }

  async function refreshReceipt() {
    const updated = await getInventoryReceiptById(receiptId);
    applyReceipt(updated);
  }

  async function refreshInvoiceDocuments() {
    if (!inventoryDocumentsEnabled) return;
    setInvoiceLoading(true);
    try {
      setInvoiceDocuments(await getInventoryReceiptDocuments(receiptId));
    } finally {
      setInvoiceLoading(false);
    }
  }

  async function uploadInvoice() {
    if (!invoiceFile || saving) {
      setError("Selecciona una factura PDF, PNG o JPEG.");
      return;
    }
    const validTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (!validTypes.includes(invoiceFile.type) || invoiceFile.size > 10 * 1024 * 1024) {
      setError("La factura debe ser PDF, PNG o JPEG y no superar 10 MB.");
      return;
    }
    setSaving(true);
    clearMessages();
    try {
      await uploadInventoryReceiptInvoice(receiptId, invoiceFile);
      setInvoiceFile(null);
      await refreshInvoiceDocuments();
      setSuccess("Factura adjuntada correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible adjuntar la factura.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receipt || saving) return;

    setSaving(true);
    clearMessages();

    try {
      await updateInventoryReceipt(receiptId, {
        numeroFactura: form.numeroFactura.trim(),
        fechaFactura: form.fechaFactura,
        numeroOrdenCompra: form.numeroOrdenCompra.trim(),
        numeroRemision: form.numeroRemision.trim(),
        observaciones: form.observaciones.trim(),
      });

      await refreshReceipt();
      setSuccess("Datos administrativos actualizados correctamente.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible guardar los cambios",
      );
    } finally {
      setSaving(false);
    }
  }

  function startReview(item: InventoryReceiptFullDetailItem) {
    if (
      item.resultadoVerificacion !== "PENDIENTE" ||
      item.detalleIngreso !== null ||
      receipt?.estado === "ANULADA"
    ) {
      setError("Este producto no puede volver a revisarse.");
      return;
    }

    closeTechnicalForms();
    setActiveTab("productos");
    setReviewingId(item.id);
    setResult("CONFORME");

    setInvimaStatus(
      item.estadoVerificacionInvima === "NO_VIGENTE"
        ? "NO_VIGENTE"
        : item.estadoVerificacionInvima === "NO_APLICA"
          ? "NO_APLICA"
          : "VIGENTE",
    );

    setTemperature(
      item.temperaturaRegistrada == null
        ? ""
        : String(item.temperaturaRegistrada),
    );
    setHumidity(
      item.humedadRegistrada == null ? "" : String(item.humedadRegistrada),
    );
    setObservations("");
    clearMessages();
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receipt || reviewingId === null || saving) return;

    const item = receipt.detalles.find((detail) => detail.id === reviewingId);

    if (
      !item ||
      item.resultadoVerificacion !== "PENDIENTE" ||
      item.detalleIngreso !== null ||
      receipt.estado === "ANULADA"
    ) {
      setError("El producto ya fue procesado o no está pendiente.");
      return;
    }

    if (!observations.trim()) {
      setError("Debes justificar la revisión en observaciones.");
      return;
    }

    if (
      result === "CONFORME" &&
      (invimaStatus === "PENDIENTE" || invimaStatus === "NO_VIGENTE")
    ) {
      setError(
        "No puedes aprobar un producto con INVIMA pendiente o no vigente.",
      );
      return;
    }

    if (
      result === "CONFORME" &&
      item.producto.tipo === "MEDICAMENTO" &&
      invimaStatus === "NO_APLICA"
    ) {
      setError("Para medicamentos debes registrar INVIMA vigente.");
      return;
    }

    const temp = temperature.trim() === "" ? undefined : Number(temperature);
    const hum = humidity.trim() === "" ? undefined : Number(humidity);

    if (
      (temp !== undefined && !Number.isFinite(temp)) ||
      (hum !== undefined && (!Number.isFinite(hum) || hum < 0 || hum > 100))
    ) {
      setError("Verifica la temperatura y la humedad (0 a 100 %).");
      return;
    }

    const question =
      result === "CONFORME"
        ? `¿Confirmas aprobar ${item.cantidadRecibida} unidades del lote ${item.numeroLote}? Se sumarán al inventario.`
        : `¿Confirmas rechazar el lote ${item.numeroLote}? No se sumará al inventario.`;

    if (!window.confirm(question)) return;

    setSaving(true);
    clearMessages();

    try {
      await reviewInventoryReceipt(receipt.id, {
        detalleActaId: reviewingId,
        resultado: result,
        estadoVerificacionInvima: invimaStatus,
        ...(temp !== undefined ? { temperaturaRegistrada: temp } : {}),
        ...(hum !== undefined ? { humedadRegistrada: hum } : {}),
        observaciones: observations.trim(),
      });

      await refreshReceipt();
      setReviewingId(null);
      setSuccess("Revisión guardada y estado del producto actualizado.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible guardar la revisión",
      );
    } finally {
      setSaving(false);
    }
  }

  function startReevaluation(item: InventoryReceiptFullDetailItem) {
    if (
      item.resultadoVerificacion !== "NO_CONFORME" ||
      item.gestionNoConforme?.estado !== "EN_CUSTODIA" ||
      receipt?.estado === "ANULADA"
    ) {
      setError("Este producto no cumple las condiciones para reevaluación.");
      return;
    }

    closeTechnicalForms();
    setActiveTab("productos");
    setReevaluatingId(item.id);
    setReevaluationInvima(item.estadoVerificacionInvima);
    setReevaluationReason("");
    setReevaluationReference("");
    setReevaluationNotes("");
    clearMessages();
  }

  async function submitReevaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receipt || reevaluatingId === null || saving) return;

    const item = receipt.detalles.find(
      (detail) => detail.id === reevaluatingId,
    );

    if (
      !item ||
      item.resultadoVerificacion !== "NO_CONFORME" ||
      item.gestionNoConforme?.estado !== "EN_CUSTODIA" ||
      receipt.estado === "ANULADA"
    ) {
      setError("El producto ya no está habilitado para reevaluación.");
      return;
    }

    if (!reevaluationReason.trim() || !reevaluationReference.trim()) {
      setError("Debes registrar el motivo y la referencia.");
      return;
    }

    if (
      !window.confirm(
        `¿Confirmas la reevaluación del lote ${item.numeroLote}? El resultado técnico cambiará a CONFORME, pero no se ingresarán existencias automáticamente.`,
      )
    ) {
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      await reevaluateInventoryReceipt(item.id, {
        resultadoNuevo: "CONFORME",
        estadoInvimaNuevo: reevaluationInvima,
        motivo: reevaluationReason.trim(),
        referencia: reevaluationReference.trim(),
        observaciones: reevaluationNotes.trim(),
      });

      await refreshReceipt();
      setReevaluatingId(null);
      setSuccess(
        "Reevaluación técnica registrada. El producto continúa sujeto a su gestión de custodia; no se ingresaron existencias.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible registrar la reevaluación",
      );
    } finally {
      setSaving(false);
    }
  }

  function startCorrection(item: InventoryReceiptFullDetailItem) {
    if (
      !receipt ||
      receipt.estado === "ANULADA" ||
      item.resultadoVerificacion === "PENDIENTE"
    ) {
      setError(
        "Solo puedes corregir verificaciones ya realizadas de recepciones no anuladas.",
      );
      return;
    }

    closeTechnicalForms();
    setActiveTab("productos");
    setCorrectingId(item.id);
    setCorrectionInvima(item.estadoVerificacionInvima);
    setCorrectionTemperature(
      item.temperaturaRegistrada == null
        ? ""
        : String(item.temperaturaRegistrada),
    );
    setCorrectionHumidity(
      item.humedadRegistrada == null ? "" : String(item.humedadRegistrada),
    );
    setCorrectionObservations(item.observaciones ?? "");
    setCorrectionReason("");
    setCorrectionReference("");
    clearMessages();
  }

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receipt || correctingId === null || saving) return;

    const item = receipt.detalles.find((detail) => detail.id === correctingId);

    if (
      !item ||
      item.resultadoVerificacion === "PENDIENTE" ||
      receipt.estado === "ANULADA"
    ) {
      setError("El producto no está habilitado para corrección documental.");
      return;
    }

    const motivo = correctionReason.trim();
    const referencia = correctionReference.trim();

    if (!motivo || !referencia) {
      setError("El motivo y la referencia documental son obligatorios.");
      return;
    }

    const temp = numberOrNull(correctionTemperature);
    const hum = numberOrNull(correctionHumidity);

    if (
      (temp !== null && !Number.isFinite(temp)) ||
      (hum !== null && (!Number.isFinite(hum) || hum < 0 || hum > 100))
    ) {
      setError("Verifica la temperatura y la humedad (0 a 100 %).");
      return;
    }

    const nuevasObservaciones = correctionObservations.trim() || null;

    const hayCambios =
      correctionInvima !== item.estadoVerificacionInvima ||
      temp !== item.temperaturaRegistrada ||
      hum !== item.humedadRegistrada ||
      nuevasObservaciones !== (item.observaciones?.trim() || null);

    if (!hayCambios) {
      setError(
        "Debes modificar al menos un dato para registrar la corrección.",
      );
      return;
    }

    if (
      item.resultadoVerificacion === "CONFORME" &&
      (correctionInvima === "PENDIENTE" || correctionInvima === "NO_VIGENTE")
    ) {
      setError(
        "No puedes mantener un producto conforme con INVIMA pendiente o no vigente.",
      );
      return;
    }

    if (
      item.resultadoVerificacion === "CONFORME" &&
      item.producto.tipo === "MEDICAMENTO" &&
      correctionInvima === "NO_APLICA"
    ) {
      setError("Para medicamentos conformes debes mantener INVIMA vigente.");
      return;
    }

    if (
      !window.confirm(
        `¿Confirmas la corrección documental del lote ${item.numeroLote}?\n\nSe actualizarán los datos de verificación y se registrará la auditoría.\n\nNo se modificarán las existencias ni el resultado de conformidad.`,
      )
    ) {
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      await correctInventoryReceiptVerification(item.id, {
        estadoVerificacionInvima: correctionInvima,
        temperaturaRegistrada: temp,
        humedadRegistrada: hum,
        observaciones: nuevasObservaciones,
        motivo,
        referencia,
      });

      await refreshReceipt();
      setCorrectingId(null);
      setAuditDetailId(null);
      setSuccess(
        "Corrección documental registrada correctamente. No se modificaron las existencias ni el resultado técnico.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible registrar la corrección documental",
      );
    } finally {
      setSaving(false);
    }
  }

  function startProductCorrection(item: InventoryReceiptFullDetailItem) {
    if (!receipt || receipt.estado === "ANULADA") {
      setError("No puedes corregir datos de una recepción anulada.");
      return;
    }

    closeTechnicalForms();
    setActiveTab("productos");
    setCorrectingProductId(item.id);
    setProductLot(item.numeroLote);
    setProductExpiration(item.fechaVencimiento.slice(0, 10));
    setProductQuantity(String(item.cantidadRecibida));
    setProductReason("");
    setProductReference("");
    setProductSupport(null);
    setPendingCorrectionId(null);
    clearMessages();
  }

  async function submitProductCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receipt || correctingProductId === null || saving) return;

    const item = receipt.detalles.find(
      (detail) => detail.id === correctingProductId,
    );

    if (!item || receipt.estado === "ANULADA") {
      setError("El producto no está disponible para corrección.");
      return;
    }

    const numeroLote = productLot.trim();
    const fechaVencimiento = productExpiration;
    const motivo = productReason.trim();
    const referencia = productReference.trim();
    const cantidadRecibida = Number(productQuantity);

    if (!numeroLote || !fechaVencimiento || !productQuantity.trim()) {
      setError(
        "El lote, la fecha de vencimiento y la cantidad son obligatorios.",
      );
      return;
    }

    if (!Number.isSafeInteger(cantidadRecibida) || cantidadRecibida <= 0) {
      setError(
        "La cantidad recibida debe ser un número entero mayor que cero.",
      );
      return;
    }

    const fecha = new Date(`${fechaVencimiento}T00:00:00.000Z`);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(fechaVencimiento) ||
      Number.isNaN(fecha.getTime()) ||
      fecha.toISOString().slice(0, 10) !== fechaVencimiento
    ) {
      setError("La fecha de vencimiento no es válida.");
      return;
    }

    if (!motivo || !referencia) {
      setError(
        "Debes indicar el motivo y la referencia documental de la corrección.",
      );
      return;
    }

    const lotChanged = numeroLote !== item.numeroLote;
    const expirationChanged =
      fechaVencimiento !== item.fechaVencimiento.slice(0, 10);
    const quantityChanged = cantidadRecibida !== item.cantidadRecibida;

    if (!lotChanged && !expirationChanged && !quantityChanged) {
      setError("Modifica al menos un dato del producto antes de guardar.");
      return;
    }

    if (quantityChanged && item.detalleIngreso !== null) {
      setError(
        "La cantidad no se puede modificar porque este producto ya tiene un ingreso asociado.",
      );
      return;
    }

    const changes: CorrectInventoryReceiptDetail = {
      ...(lotChanged ? { numeroLote } : {}),
      ...(expirationChanged ? { fechaVencimiento } : {}),
      ...(quantityChanged ? { cantidadRecibida } : {}),
      motivo,
      referencia,
    };

    if (
      !window.confirm(
        `¿Confirmas la corrección de los datos del producto ${item.producto.descripcion}?\n\nSe registrará el motivo y soporte documental. La operación no debe alterar automáticamente las existencias.`,
      )
    ) {
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      const correction = pendingCorrectionId
        ? { correccionId: pendingCorrectionId }
        : await correctInventoryReceiptDetail(item.id, changes);
      if (productSupport) {
        setPendingCorrectionId(correction.correccionId);
        await uploadInventoryReceiptCorrectionSupport(correction.correccionId, productSupport);
      }
      await refreshReceipt();
      setCorrectingProductId(null);
      setProductSupport(null);
      setPendingCorrectionId(null);
      setSuccess(
        "Datos del producto corregidos correctamente. La recepción fue actualizada.",
      );
    } catch (err) {
      if (!pendingCorrectionId) {
        // La corrección ya es inmutable aunque la escritura del archivo falle.
        // Conservamos su id para que el usuario pueda reintentar solo la carga.
        // No se repite la modificación de datos ni se altera inventario.
      }
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible corregir los datos del producto",
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedAuditItem = receipt?.detalles.find(
    (item) => item.id === auditDetailId,
  );

  const selectedProductItem = receipt?.detalles.find(
    (item) => item.id === correctingProductId,
  );

  return (
    <main className="s007-receipt-page">
      <button
        type="button"
        className="receipt-secondary-button"
        onClick={() => navigate("/inventory")}
        disabled={saving}
      >
        Volver al inventario
      </button>

      <section className="inventory-content inventory-receipts s007-receipt-shell">
        <header className="s007-receipt-header">
          <div>
            <div className="s007-eyebrow">
              SISTEMA 007 / INVENTARIO / RECEPCIONES
            </div>
            <h1>Gestión de recepción</h1>
            <p>Control documental, verificación técnica y trazabilidad</p>
          </div>

          {receipt && (
            <span
              className={`s007-status s007-status-${receipt.estado.toLowerCase()}`}
            >
              {displayStatus(receipt.estado)}
            </span>
          )}
        </header>

        {loading && <p>Cargando recepción...</p>}

        {error && (
          <p className="receipt-error" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="receipt-success" role="status">
            {success}
          </p>
        )}

        {receipt && !loading && (
          <>
            <div className="s007-overview">
              <div>
                <small>ACTA DE RECEPCIÓN</small>
                <strong>{receipt.numeroActa}</strong>
              </div>
              <div>
                <small>FACTURA</small>
                <strong>{receipt.numeroFactura}</strong>
              </div>
              <div>
                <small>PROVEEDOR</small>
                <strong>{receipt.proveedor?.razonSocial}</strong>
              </div>
              <div>
                <small>FECHA DE RECEPCIÓN</small>
                <strong>{formatDate(receipt.fechaRecepcion)}</strong>
              </div>
              <div>
                <small>BODEGA DESTINO</small>
                <strong>
                  {receipt.ingresoInventario?.bodegaDestino?.nombre ??
                    "Sin ingreso confirmado"}
                </strong>
              </div>
            </div>

            {receipt.estado === "RECHAZADA" && (
              <div className="s007-state-notice">
                <strong>Recepción rechazada</strong>
                <span>
                  El estado se determina por la gestión técnica de los
                  productos. Para revisar una no conformidad, utiliza las
                  acciones habilitadas en Productos y verificación. No es
                  posible cambiarlo directamente sin trazabilidad.
                </span>
              </div>
            )}

            <nav
              className="s007-tabs"
              aria-label="Secciones de gestión de recepción"
            >
              <button
                type="button"
                className={activeTab === "general" ? "active" : ""}
                onClick={() => setActiveTab("general")}
              >
                Datos generales
              </button>
              <button
                type="button"
                className={activeTab === "productos" ? "active" : ""}
                onClick={() => setActiveTab("productos")}
              >
                Productos y verificación
                <span>{receipt.totalProductos}</span>
              </button>
              <button
                type="button"
                className={activeTab === "auditoria" ? "active" : ""}
                onClick={() => setActiveTab("auditoria")}
              >
                Auditoría técnica
              </button>
            </nav>

            {activeTab === "general" && (
              <div className="s007-panel">
                <h2>Datos administrativos</h2>

                <form onSubmit={(event) => void handleSubmit(event)}>
                  <div className="inventory-receipt-grid">
                    <div className="inventory-receipt-field">
                      <label htmlFor="manage-invoice">Número de factura</label>
                      <input
                        id="manage-invoice"
                        value={form.numeroFactura}
                        maxLength={100}
                        required
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            numeroFactura: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="inventory-receipt-field">
                      <label htmlFor="manage-date">Fecha de factura</label>
                      <input
                        id="manage-date"
                        type="date"
                        value={form.fechaFactura}
                        required
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            fechaFactura: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="inventory-receipt-field">
                      <label htmlFor="manage-order">Orden de compra</label>
                      <input
                        id="manage-order"
                        value={form.numeroOrdenCompra}
                        maxLength={100}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            numeroOrdenCompra: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="inventory-receipt-field">
                      <label htmlFor="manage-remission">
                        Número de remisión
                      </label>
                      <input
                        id="manage-remission"
                        value={form.numeroRemision}
                        maxLength={100}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            numeroRemision: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="inventory-receipt-field inventory-receipt-full">
                      <label htmlFor="manage-notes">
                        Observaciones generales
                      </label>
                      <textarea
                        id="manage-notes"
                        rows={3}
                        value={form.observaciones}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            observaciones: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="inventory-receipt-footer">
                    <button
                      type="submit"
                      className="inventory-receipt-submit"
                      disabled={saving || receipt.estado === "ANULADA"}
                    >
                      {saving
                        ? "Guardando..."
                        : "Guardar datos administrativos"}
                    </button>
                  </div>
                </form>

                {inventoryDocumentsEnabled && (
                  <section className="receipt-detail-panel" style={{ marginTop: 20 }}>
                    <h3>Facturas y anexos</h3>
                    <p>Adjunta PDF, PNG o JPEG de máximo 10 MB. Los documentos quedan bajo custodia privada.</p>
                    <div className="inventory-receipt-footer">
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        onChange={(event) => setInvoiceFile(event.target.files?.[0] ?? null)}
                        disabled={saving}
                      />
                      <button type="button" className="inventory-receipt-submit" onClick={() => void uploadInvoice()} disabled={saving || !invoiceFile}>
                        Adjuntar factura
                      </button>
                      <button type="button" className="inventory-receipt-submit" onClick={() => void refreshInvoiceDocuments()} disabled={invoiceLoading}>
                        {invoiceLoading ? "Consultando..." : "Actualizar archivos"}
                      </button>
                    </div>
                    {invoiceDocuments.length > 0 && (
                      <ul>
                        {invoiceDocuments.map((document) => (
                          <li key={document.id}>
                            Factura v{document.version} · {document.registradoPor.nombre} · {formatDateTime(document.documentoInventario.creadoAt)}
                            <button type="button" onClick={() => void downloadInventoryDocument(document.documentoInventario.id)}>Descargar</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </div>
            )}

            {activeTab === "productos" && (
              <div className="receipt-detail-panel s007-panel">
                <div className="receipt-detail-heading">
                  <div>
                    <h2>Detalle de productos recibidos</h2>
                    <p>Verificación técnica y seguimiento de lotes</p>
                  </div>
                </div>

                <div className="receipt-detail-meta">
                  <span>
                    <b>Total:</b> {receipt.totalProductos}
                  </span>
                  <span>
                    <b>Conformes:</b> {receipt.totalConformes}
                  </span>
                  <span>
                    <b>Pendientes:</b> {receipt.totalPendientes}
                  </span>
                  <span>
                    <b>No conformes:</b> {receipt.totalNoConformes}
                  </span>
                </div>

                <div className="receipt-detail-table-wrap">
                  <table className="receipt-detail-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Lote</th>
                        <th>Vencimiento</th>
                        <th>Recibido</th>
                        <th>Ingresado</th>
                        <th>INVIMA</th>
                        <th>Resultado</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipt.detalles.map((item) => {
                        const canReview =
                          item.resultadoVerificacion === "PENDIENTE" &&
                          item.detalleIngreso === null &&
                          receipt.estado !== "ANULADA";

                        const canReevaluate =
                          item.resultadoVerificacion === "NO_CONFORME" &&
                          item.gestionNoConforme?.estado === "EN_CUSTODIA" &&
                          receipt.estado !== "ANULADA";

                        const canCorrect =
                          item.resultadoVerificacion !== "PENDIENTE" &&
                          receipt.estado !== "ANULADA";

                        const canCorrectProduct = receipt.estado !== "ANULADA";

                        const auditCount =
                          item.reevaluacionesTecnicas?.length ?? 0;

                        return (
                          <tr key={item.id}>
                            <td>
                              {item.producto?.descripcion ?? "Sin descripción"}
                            </td>
                            <td>{item.numeroLote}</td>
                            <td>{formatDate(item.fechaVencimiento)}</td>
                            <td>{item.cantidadRecibida}</td>
                            <td>
                              {item.detalleIngreso?.cantidadIngresada ?? 0}
                            </td>
                            <td>
                              {displayStatus(item.estadoVerificacionInvima)}
                            </td>
                            <td>{displayStatus(item.resultadoVerificacion)}</td>
                            <td>
                              <div className="s007-row-actions">
                                {canReview ? (
                                  <button
                                    type="button"
                                    className="receipt-action"
                                    disabled={saving}
                                    onClick={() => startReview(item)}
                                  >
                                    Revisar
                                  </button>
                                ) : (
                                  <span className="receipt-reviewed">
                                    {item.detalleIngreso
                                      ? "Ingresado"
                                      : "Revisado"}
                                  </span>
                                )}

                                {canReevaluate && (
                                  <button
                                    type="button"
                                    className="receipt-action"
                                    disabled={saving}
                                    onClick={() => startReevaluation(item)}
                                  >
                                    Reevaluar
                                  </button>
                                )}

                                {canCorrect && (
                                  <button
                                    type="button"
                                    className="receipt-action"
                                    disabled={saving}
                                    onClick={() => startCorrection(item)}
                                  >
                                    Corregir verificación
                                  </button>
                                )}

                                {canCorrectProduct && (
                                  <button
                                    type="button"
                                    className="receipt-action"
                                    disabled={saving}
                                    onClick={() => startProductCorrection(item)}
                                  >
                                    Corregir datos del producto
                                  </button>
                                )}

                                {auditCount > 0 && (
                                  <button
                                    type="button"
                                    className="receipt-secondary-button"
                                    disabled={saving}
                                    onClick={() => {
                                      setAuditDetailId(item.id);
                                      setActiveTab("auditoria");
                                    }}
                                  >
                                    Historial ({auditCount})
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {selectedProductItem && (
                  <div
                    className="s007-receipt-modal-backdrop"
                    role="presentation"
                    onMouseDown={() => !saving && setCorrectingProductId(null)}
                  >
                  <form
                    className="receipt-review-form s007-receipt-modal"
                    onSubmit={(event) => void submitProductCorrection(event)}
                    onMouseDown={(event) => event.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="receipt-correction-title"
                  >
                    <h3 id="receipt-correction-title">Corregir datos del producto</h3>
                    <p>
                      <b>Producto:</b>{" "}
                      {selectedProductItem.producto.descripcion}
                    </p>
                    <p>
                      Los cambios requieren motivo y soporte documental. No se
                      realizan ajustes automáticos de existencias.
                    </p>

                    <div className="receipt-review-fields">
                      <label>
                        Número de lote
                        <input
                          required
                          value={productLot}
                          disabled={saving}
                          onChange={(event) =>
                            setProductLot(event.target.value)
                          }
                        />
                      </label>

                      <label>
                        Fecha de vencimiento
                        <input
                          required
                          type="date"
                          value={productExpiration}
                          disabled={saving}
                          onChange={(event) =>
                            setProductExpiration(event.target.value)
                          }
                        />
                      </label>

                      <label>
                        Cantidad recibida
                        <input
                          required
                          type="number"
                          min="1"
                          step="1"
                          value={productQuantity}
                          disabled={
                            saving ||
                            selectedProductItem.detalleIngreso !== null
                          }
                          onChange={(event) =>
                            setProductQuantity(event.target.value)
                          }
                        />
                      </label>

                      <label>
                        Motivo de la corrección
                        <input
                          required
                          value={productReason}
                          disabled={saving}
                          onChange={(event) =>
                            setProductReason(event.target.value)
                          }
                          placeholder="Justificación del cambio"
                        />
                      </label>

                      <label>
                        Referencia o soporte documental
                        <input
                          required
                          value={productReference}
                          disabled={saving}
                          onChange={(event) =>
                            setProductReference(event.target.value)
                          }
                          placeholder="Acta, factura o documento de soporte"
                        />
                      </label>

                      {inventoryDocumentsEnabled && (
                        <label className="receipt-correction-upload">
                          Adjuntar soporte de corrección (opcional)
                          <input
                            type="file"
                            accept="application/pdf,image/png,image/jpeg"
                            disabled={saving}
                            onChange={(event) =>
                              setProductSupport(event.target.files?.[0] ?? null)
                            }
                          />
                          <small>PDF, PNG o JPEG; máximo 10 MB. Cada carga queda como una versión inmutable.</small>
                          {productSupport && (
                            <span className="receipt-selected-file">
                              {productSupport.name} ({Math.ceil(productSupport.size / 1024)} KB)
                              <button type="button" disabled={saving} onClick={() => setProductSupport(null)}>
                                Retirar archivo
                              </button>
                            </span>
                          )}
                        </label>
                      )}
                    </div>

                    {selectedProductItem.detalleIngreso !== null && (
                      <p>
                        La cantidad recibida está bloqueada porque existe un
                        ingreso de inventario asociado. Las demás correcciones
                        quedan sujetas a validación del backend.
                      </p>
                    )}

                    <div className="receipt-review-actions">
                      <button
                        type="button"
                        className="receipt-secondary-button"
                        disabled={saving}
                        onClick={() => setCorrectingProductId(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="receipt-primary-button"
                        disabled={saving}
                      >
                        {saving
                          ? "Guardando..."
                          : "Guardar corrección de producto"}
                      </button>
                    </div>
                  </form>
                  </div>
                )}

                {correctingId !== null && (
                  <form
                    className="receipt-review-form"
                    onSubmit={(event) => void submitCorrection(event)}
                  >
                    <h3>Corregir verificación técnica</h3>
                    <p>
                      <b>Producto:</b>{" "}
                      {
                        receipt.detalles.find(
                          (item) => item.id === correctingId,
                        )?.producto.descripcion
                      }
                    </p>
                    <p>
                      <b>Lote:</b>{" "}
                      {
                        receipt.detalles.find(
                          (item) => item.id === correctingId,
                        )?.numeroLote
                      }
                    </p>
                    <p>
                      El resultado técnico y las existencias permanecerán sin
                      cambios.
                    </p>

                    <div className="receipt-review-fields">
                      <label>
                        Estado INVIMA
                        <select
                          value={correctionInvima}
                          disabled={saving}
                          onChange={(event) =>
                            setCorrectionInvima(
                              event.target.value as InventoryInvimaStatus,
                            )
                          }
                        >
                          <option value="VIGENTE">Vigente</option>
                          <option value="PENDIENTE">Pendiente</option>
                          <option value="NO_VIGENTE">No vigente</option>
                          <option value="NO_APLICA">No aplica</option>
                        </select>
                      </label>

                      <label>
                        Temperatura registrada (°C)
                        <input
                          type="number"
                          step="any"
                          value={correctionTemperature}
                          disabled={saving}
                          onChange={(event) =>
                            setCorrectionTemperature(event.target.value)
                          }
                        />
                      </label>

                      <label>
                        Humedad registrada (%)
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          value={correctionHumidity}
                          disabled={saving}
                          onChange={(event) =>
                            setCorrectionHumidity(event.target.value)
                          }
                        />
                      </label>

                      <label>
                        Motivo de la corrección
                        <input
                          required
                          value={correctionReason}
                          disabled={saving}
                          onChange={(event) =>
                            setCorrectionReason(event.target.value)
                          }
                        />
                      </label>

                      <label>
                        Referencia o soporte documental
                        <input
                          required
                          value={correctionReference}
                          disabled={saving}
                          onChange={(event) =>
                            setCorrectionReference(event.target.value)
                          }
                        />
                      </label>
                    </div>

                    <label>
                      Observaciones de verificación
                      <textarea
                        rows={3}
                        value={correctionObservations}
                        disabled={saving}
                        onChange={(event) =>
                          setCorrectionObservations(event.target.value)
                        }
                      />
                    </label>

                    <div className="receipt-review-actions">
                      <button
                        type="button"
                        className="receipt-secondary-button"
                        disabled={saving}
                        onClick={() => setCorrectingId(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="receipt-primary-button"
                        disabled={saving}
                      >
                        {saving ? "Guardando..." : "Guardar corrección"}
                      </button>
                    </div>
                  </form>
                )}

                {reevaluatingId !== null && (
                  <form
                    className="receipt-review-form"
                    onSubmit={(event) => void submitReevaluation(event)}
                  >
                    <h3>Reevaluación técnica</h3>
                    <p>
                      Lote:{" "}
                      {
                        receipt.detalles.find(
                          (item) => item.id === reevaluatingId,
                        )?.numeroLote
                      }
                    </p>
                    <p>
                      La reevaluación no libera ni ingresa existencias
                      automáticamente.
                    </p>

                    <div className="receipt-review-fields">
                      <label>
                        Nuevo resultado
                        <input value="CONFORME" disabled readOnly />
                      </label>

                      <label>
                        Verificación INVIMA
                        <select
                          value={reevaluationInvima}
                          disabled={saving}
                          onChange={(event) =>
                            setReevaluationInvima(
                              event.target.value as InventoryInvimaStatus,
                            )
                          }
                        >
                          <option value="VIGENTE">Vigente</option>
                          <option value="PENDIENTE">Pendiente</option>
                          <option value="NO_VIGENTE">No vigente</option>
                          <option value="NO_APLICA">No aplica</option>
                        </select>
                      </label>

                      <label>
                        Motivo de la reevaluación
                        <input
                          required
                          value={reevaluationReason}
                          disabled={saving}
                          onChange={(event) =>
                            setReevaluationReason(event.target.value)
                          }
                        />
                      </label>

                      <label>
                        Referencia o soporte
                        <input
                          required
                          value={reevaluationReference}
                          disabled={saving}
                          onChange={(event) =>
                            setReevaluationReference(event.target.value)
                          }
                        />
                      </label>
                    </div>

                    <label>
                      Observaciones
                      <textarea
                        rows={3}
                        value={reevaluationNotes}
                        disabled={saving}
                        onChange={(event) =>
                          setReevaluationNotes(event.target.value)
                        }
                      />
                    </label>

                    <div className="receipt-review-actions">
                      <button
                        type="button"
                        className="receipt-secondary-button"
                        disabled={saving}
                        onClick={() => setReevaluatingId(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="receipt-primary-button"
                        disabled={saving}
                      >
                        {saving ? "Guardando..." : "Guardar reevaluación"}
                      </button>
                    </div>
                  </form>
                )}

                {reviewingId !== null && (
                  <form
                    className="receipt-review-form"
                    onSubmit={(event) => void submitReview(event)}
                  >
                    <h3>Revisar producto pendiente</h3>
                    <p>
                      Lote:{" "}
                      {
                        receipt.detalles.find((item) => item.id === reviewingId)
                          ?.numeroLote
                      }
                    </p>

                    <div className="receipt-review-fields">
                      <label>
                        Resultado
                        <select
                          value={result}
                          disabled={saving}
                          onChange={(event) =>
                            setResult(event.target.value as ReviewResult)
                          }
                        >
                          <option value="CONFORME">
                            Conforme (aprobar ingreso)
                          </option>
                          <option value="NO_CONFORME">
                            No conforme (rechazar)
                          </option>
                        </select>
                      </label>

                      <label>
                        Verificación INVIMA
                        <select
                          value={invimaStatus}
                          disabled={saving}
                          onChange={(event) =>
                            setInvimaStatus(
                              event.target.value as InventoryInvimaStatus,
                            )
                          }
                        >
                          <option value="VIGENTE">Vigente</option>
                          <option value="PENDIENTE">Pendiente</option>
                          <option value="NO_VIGENTE">No vigente</option>
                          <option value="NO_APLICA">No aplica</option>
                        </select>
                      </label>

                      <label>
                        Temperatura registrada (°C)
                        <input
                          type="number"
                          step="any"
                          value={temperature}
                          disabled={saving}
                          onChange={(event) =>
                            setTemperature(event.target.value)
                          }
                        />
                      </label>

                      <label>
                        Humedad registrada (%)
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          value={humidity}
                          disabled={saving}
                          onChange={(event) => setHumidity(event.target.value)}
                        />
                      </label>
                    </div>

                    <label>
                      Observaciones de la revisión
                      <textarea
                        rows={3}
                        required
                        value={observations}
                        disabled={saving}
                        onChange={(event) =>
                          setObservations(event.target.value)
                        }
                      />
                    </label>

                    <div className="receipt-review-actions">
                      <button
                        type="button"
                        className="receipt-secondary-button"
                        disabled={saving}
                        onClick={() => setReviewingId(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="receipt-primary-button"
                        disabled={saving}
                      >
                        {saving ? "Guardando..." : "Guardar revisión"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {activeTab === "auditoria" && (
              <div className="s007-panel">
                <h2>Auditoría técnica</h2>
                <p>
                  Selecciona un producto para consultar sus reevaluaciones y
                  correcciones técnicas registradas.
                </p>

                <div className="s007-audit-pick">
                  {receipt.detalles.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={auditDetailId === item.id ? "selected" : ""}
                      onClick={() => setAuditDetailId(item.id)}
                    >
                      {item.producto.descripcion} · Lote {item.numeroLote} ·{" "}
                      {item.reevaluacionesTecnicas?.length ?? 0} registros
                    </button>
                  ))}
                </div>

                {selectedAuditItem && (
                  <section
                    className="receipt-review-form"
                    style={{ marginTop: 24 }}
                  >
                    <h3>Historial de auditoría técnica</h3>
                    <p>
                      <b>Producto:</b> {selectedAuditItem.producto.descripcion}
                    </p>
                    <p>
                      <b>Lote:</b> {selectedAuditItem.numeroLote}
                    </p>

                    {(selectedAuditItem.reevaluacionesTecnicas ?? []).length ===
                    0 ? (
                      <p>
                        Este producto no tiene registros de auditoría técnica.
                      </p>
                    ) : (
                      <div className="receipt-detail-table-wrap">
                        <table className="receipt-detail-table">
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Tipo</th>
                              <th>Responsable</th>
                              <th>Cambios registrados</th>
                              <th>Motivo y soporte</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(
                              selectedAuditItem.reevaluacionesTecnicas ?? []
                            ).map((audit) => (
                              <tr key={audit.id}>
                                <td>
                                  {formatDateTime(audit.fechaReevaluacion)}
                                </td>
                                <td>
                                  {audit.tipoCambio === "CORRECCION_DOCUMENTAL"
                                    ? "Corrección documental"
                                    : audit.tipoCambio === "REEVALUACION"
                                      ? "Reevaluación técnica"
                                      : "Registro técnico"}
                                </td>
                                <td>
                                  {audit.responsableId
                                    ? `Usuario ${audit.responsableId}`
                                    : "Sin identificar"}
                                </td>
                                <td>
                                  <div className="s007-audit-changes">
                                    <span>
                                      <b>Resultado:</b>{" "}
                                      {displayStatus(audit.resultadoAnterior)} →{" "}
                                      {displayStatus(audit.resultadoNuevo)}
                                    </span>
                                    <span>
                                      <b>INVIMA:</b>{" "}
                                      {displayStatus(
                                        audit.estadoInvimaAnterior,
                                      )}{" "}
                                      → {displayStatus(audit.estadoInvimaNuevo)}
                                    </span>

                                    {audit.tipoCambio ===
                                      "CORRECCION_DOCUMENTAL" && (
                                      <>
                                        <span>
                                          <b>Temperatura:</b>{" "}
                                          {displayValue(
                                            audit.temperaturaAnterior,
                                          )}{" "}
                                          →{" "}
                                          {displayValue(audit.temperaturaNueva)}
                                        </span>
                                        <span>
                                          <b>Humedad:</b>{" "}
                                          {displayValue(audit.humedadAnterior)}{" "}
                                          → {displayValue(audit.humedadNueva)}
                                        </span>
                                        <span>
                                          <b>Observaciones anteriores:</b>{" "}
                                          {displayValue(
                                            audit.observacionesAnteriores,
                                          )}
                                        </span>
                                        <span>
                                          <b>Observaciones nuevas:</b>{" "}
                                          {displayValue(
                                            audit.observacionesNuevas,
                                          )}
                                        </span>
                                      </>
                                    )}

                                    {audit.observaciones && (
                                      <span>
                                        <b>Nota de auditoría:</b>{" "}
                                        {audit.observaciones}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className="s007-audit-changes">
                                    <span>
                                      <b>Motivo:</b> {audit.motivo}
                                    </span>
                                    <span>
                                      <b>Referencia:</b> {audit.referencia}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {(selectedAuditItem.correcciones ?? []).length > 0 && (
                      <section className="receipt-correction-history">
                        <h4>Correcciones de datos y soportes</h4>
                        {(selectedAuditItem.correcciones ?? []).map((correction) => (
                          <div className="receipt-correction-history__entry" key={correction.id}>
                            <p><b>{formatDateTime(correction.fechaCorreccion)}</b> · {correction.motivo}</p>
                            <p>Referencia: {correction.referencia}</p>
                            {(correction.documentos ?? []).length === 0 ? (
                              <small>Sin archivo adjunto; se conserva la referencia documental registrada.</small>
                            ) : (
                              <div className="receipt-correction-history__documents">
                                {(correction.documentos ?? []).map((document) => (
                                  <button
                                    type="button"
                                    className="receipt-secondary-button"
                                    key={document.id}
                                    onClick={() => void downloadInventoryDocument(document.documentoInventario.id)}
                                  >
                                    Descargar soporte v{document.version}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </section>
                    )}

                    <div className="receipt-review-actions">
                      <button
                        type="button"
                        className="receipt-secondary-button"
                        onClick={() => setAuditDetailId(null)}
                      >
                        Cerrar historial
                      </button>
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
