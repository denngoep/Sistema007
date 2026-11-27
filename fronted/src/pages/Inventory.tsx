import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import InventoryReceipts from "./InventoryReceipts";
import InventoryTransfers from "./InventoryTransfers";
import InventoryAdjustments from "./InventoryAdjustments";
import InventoryExpirations from "./InventoryExpirations";
import InventoryWarehouses from "./InventoryWarehouses";
import { useFunctionalTestAccess } from "../components/functional-test-access";

import {
  createInventoryProduct,
  createInventoryReceipt,
  createInventorySupplier,
  getInventoryProducts,
  getInventorySuppliers,
  getInventoryWarehouses,
  type CreateInventoryProduct,
  type CreateInventorySupplier,
  type InventoryConservationCondition,
  type InventoryInvimaStatus,
  type InventoryProduct,
  type InventoryProductType,
  type InventoryReceiptItem,
  type InventoryReceiptResponse,
  type InventorySupplier,
  type InventoryVerificationResult,
  type InventoryWarehouseOption,
} from "../services/inventory.service";

import "../styles/Inventory.css";
import "../styles/InventoryEntry.css";

type InventorySection =
  | "home"
  | "products"
  | "entry"
  | "receipts"
  | "transfer"
  | "adjustment"
  | "expiration"
  | "warehouses";

const inventorySections: InventorySection[] = [
  "home",
  "products",
  "entry",
  "receipts",
  "transfer",
  "adjustment",
  "expiration",
  "warehouses",
];

function sectionFromUrl(value: string | null): InventorySection {
  return inventorySections.includes(value as InventorySection)
    ? (value as InventorySection)
    : "home";
}

type ModuleIcon =
  | "entry"
  | "transfer"
  | "adjustment"
  | "expiration"
  | "products"
  | "movements";

interface InventoryModule {
  id: string;
  title: string;
  description: string;
  icon: ModuleIcon;
  enabled: boolean;
}

interface ReceiptForm {
  numeroFactura: string;
  fechaFactura: string;
  proveedorId: string;
  bodegaDestinoId: string;
  observaciones: string;
}

interface ReceiptRow {
  id: number;
  codigo: string;
  productoId: string;
  numeroLote: string;
  fechaVencimiento: string;
  cantidad: string;
  costoUnitario: string;
  estadoVerificacionInvima: InventoryInvimaStatus;
  temperaturaRegistrada: string;
  humedadRegistrada: string;
  resultadoVerificacion: InventoryVerificationResult;
  observacionesVerificacion: string;
}

interface NewProductForm {
  tipo: InventoryProductType;
  descripcion: string;
  nombre: string;
  concentracion: string;
  formaFarmaceutica: string;
  marca: string;
  laboratorio: string;
  registroInvima: string;
  condicionConservacion: InventoryConservationCondition;
  claseRiesgo: string;
}

const inventoryModules: InventoryModule[] = [
  {
    id: "entry",
    title: "Ingreso de productos",
    description: "Recepción de medicamentos e insumos mediante factura.",
    icon: "entry",
    enabled: true,
  },
  {
    id: "receipts",
    title: "Seguimiento de recepciones",
    description:
      "Consulta las facturas registradas y el estado de su verificación técnica.",
    icon: "movements",
    enabled: true,
  },
  {
    id: "transfer",
    title: "Traslados",
    description: "Movimiento de existencias entre bodegas.",
    icon: "transfer",
    enabled: true,
  },
  {
    id: "adjustment",
    title: "Ajustes de inventario",
    description: "Corrección y justificación de existencias.",
    icon: "adjustment",
    enabled: true,
  },
  {
    id: "expiration",
    title: "Vencimientos",
    description: "Seguimiento y gestión de lotes.",
    icon: "expiration",
    enabled: true,
  },
  {
    id: "products",
    title: "Productos y existencias",
    description: "Consulta de medicamentos, insumos y lotes.",
    icon: "products",
    enabled: true,
  },
  {
    id: "movements",
    title: "Movimientos",
    description: "Consulta, filtra y descarga los movimientos de inventario.",
    icon: "movements",
    enabled: true,
  },
  {
    id: "warehouses",
    title: "Configuración de bodegas",
    description: "Registra, activa y desactiva bodegas con trazabilidad.",
    icon: "products",
    enabled: true,
  },
];

const emptyReceiptForm: ReceiptForm = {
  numeroFactura: "",
  fechaFactura: "",
  proveedorId: "",
  bodegaDestinoId: "",
  observaciones: "",
};

const emptySupplierForm = (): CreateInventorySupplier => ({
  nit: "",
  razonSocial: "",
  nombreComercial: "",
  telefono: "",
  correo: "",
  direccion: "",
  contacto: "",
});

const emptyNewProductForm = (): NewProductForm => ({
  tipo: "MEDICAMENTO",
  descripcion: "",
  nombre: "",
  concentracion: "",
  formaFarmaceutica: "",
  marca: "",
  laboratorio: "",
  registroInvima: "",
  condicionConservacion: "AMBIENTE",
  claseRiesgo: "",
});

const createEmptyRow = (id: number): ReceiptRow => ({
  id,
  codigo: "",
  productoId: "",
  numeroLote: "",
  fechaVencimiento: "",
  cantidad: "",
  costoUnitario: "",
  estadoVerificacionInvima: "PENDIENTE",
  temperaturaRegistrada: "",
  humedadRegistrada: "",
  resultadoVerificacion: "PENDIENTE",
  observacionesVerificacion: "",
});

const todayColombia = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(amount);

const isMedicalDevice = (product: InventoryProduct) =>
  product.tipo === "DISPOSITIVO_MEDICO";

function InventoryIcon({
  name,
  size = 24,
}: {
  name: ModuleIcon;
  size?: number;
}) {
  const paths: Record<ModuleIcon, ReactNode> = {
    entry: (
      <>
        <path d="M12 3v12M7 10l5 5 5-5" />
        <path d="M4 17v4h16v-4" />
      </>
    ),
    transfer: (
      <>
        <path d="M4 7h16M16 3l4 4-4 4" />
        <path d="M20 17H4M8 13l-4 4 4 4" />
      </>
    ),
    adjustment: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4.5h6M9 11h6M9 15h4" />
        <path d="M17 17l3-3" />
      </>
    ),
    expiration: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
        <circle cx="12" cy="15" r="3" />
        <path d="M12 13.5V15l1 1" />
      </>
    ),
    products: (
      <>
        <path d="m3 7 9-4 9 4-9 4-9-4Z" />
        <path d="M3 7v10l9 4 9-4" />
        <path d="M12 11v10" />
      </>
    ),
    movements: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "rgba(4, 24, 47, 0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
} as const;

const modalPanelStyle = {
  width: "100%",
  maxWidth: "720px",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: "16px",
  padding: "28px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
} as const;

type InventoryUserRole =
  | "ADMINISTRADOR"
  | "REGENTE_FARMACIA"
  | "AUXILIAR_FARMACIA"
  | "QUIMICO_FARMACEUTICO";

const MANAGEMENT_ROLES: InventoryUserRole[] = [
  "ADMINISTRADOR",
  "REGENTE_FARMACIA",
  "QUIMICO_FARMACEUTICO",
];

const MODULES_BY_ROLE: Record<InventoryUserRole, ReadonlySet<string>> = {
  ADMINISTRADOR: new Set(inventoryModules.map((module) => module.id)),
  REGENTE_FARMACIA: new Set(inventoryModules.map((module) => module.id)),
  QUIMICO_FARMACEUTICO: new Set(inventoryModules.map((module) => module.id)),
  AUXILIAR_FARMACIA: new Set([
    "products",
    "movements",
    "receipts",
    "transfer",
    "expiration",
  ]),
};

function getInventoryUserRole(): InventoryUserRole | null {
  try {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return null;
    const role: unknown = JSON.parse(savedUser)?.rol;
    if (
      role === "ADMINISTRADOR" ||
      role === "REGENTE_FARMACIA" ||
      role === "AUXILIAR_FARMACIA" ||
      role === "QUIMICO_FARMACEUTICO"
    ) {
      return role;
    }
  } catch {
    return null;
  }
  return null;
}

function Inventory() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const userRole = getInventoryUserRole();
  const functionalTestAccess = useFunctionalTestAccess();
  const canManageInventory =
    functionalTestAccess || (userRole !== null && MANAGEMENT_ROLES.includes(userRole));
  const canManageWarehouses =
    functionalTestAccess ||
    userRole === "ADMINISTRADOR" ||
    (userRole !== null && MANAGEMENT_ROLES.includes(userRole));
  const allowedModules = functionalTestAccess
    ? new Set(inventoryModules.map((module) => module.id))
    : userRole
    ? MODULES_BY_ROLE[userRole]
    : new Set<string>();
  const visibleModules = inventoryModules.filter((module) =>
    allowedModules.has(module.id),
  );
  const nextRowId = useRef(2);

  const requestedSection = sectionFromUrl(searchParams.get("section"));
  const sectionAllowed =
    requestedSection === "home" ||
    (requestedSection === "entry" && (canManageInventory || userRole === "ADMINISTRADOR")) ||
    (requestedSection !== "entry" && allowedModules.has(requestedSection));
  const section = sectionAllowed ? requestedSection : "home";
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  const [receiptForm, setReceiptForm] = useState<ReceiptForm>({
    ...emptyReceiptForm,
  });

  const [receiptRows, setReceiptRows] = useState<ReceiptRow[]>([
    createEmptyRow(1),
  ]);

  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [receiptResult, setReceiptResult] =
    useState<InventoryReceiptResponse | null>(null);

  const goToSection = (next: InventorySection) => {
    setSearchParams(next === "home" ? {} : { section: next });
  };

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] =
    useState<CreateInventorySupplier>(emptySupplierForm);
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [supplierError, setSupplierError] = useState("");

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [newProductForm, setNewProductForm] =
    useState<NewProductForm>(emptyNewProductForm);
  const [productSaving, setProductSaving] = useState(false);
  const [newProductError, setNewProductError] = useState("");
  const [productTargetRowId, setProductTargetRowId] = useState<number | null>(
    null,
  );

  const loadInventory = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getInventoryProducts();
      setProducts(data.productos);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible consultar el inventario.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    getInventoryProducts()
      .then((data) => {
        if (active) {
          setProducts(data.productos);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "No fue posible consultar el inventario.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (section !== "entry") return;

    let active = true;

    const loadCatalogs = async () => {
      setCatalogLoading(true);
      setCatalogError("");

      try {
        const [supplierData, warehouseData] = await Promise.all([
          getInventorySuppliers(),
          getInventoryWarehouses(),
        ]);

        if (!active) return;

        setSuppliers(supplierData);
        setWarehouses(warehouseData);
      } catch (err) {
        if (active) {
          setCatalogError(
            err instanceof Error
              ? err.message
              : "No fue posible cargar proveedores y bodegas.",
          );
        }
      } finally {
        if (active) setCatalogLoading(false);
      }
    };

    void loadCatalogs();

    return () => {
      active = false;
    };
  }, [section]);

  const rows = useMemo(() => {
    const today = todayColombia();

    return products.flatMap((product) =>
      product.lotes.flatMap((batch) =>
        batch.existencias.map((stock) => {
          const expired = batch.fechaVencimiento.slice(0, 10) < today;

          const available =
            product.estado === "ACTIVO" &&
            batch.estado === "DISPONIBLE" &&
            stock.bodega.activa &&
            stock.bodega.permiteDispensacion &&
            !expired &&
            stock.cantidad > 0;

          return {
            id: stock.id,
            product,
            batch,
            stock,
            expired,
            available,
          };
        }),
      ),
    );
  }, [products]);

  const filteredRows = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return rows;

    return rows.filter(({ product, batch, stock }) =>
      [
        product.codigoInterno,
        product.codigoBarras,
        product.descripcion,
        product.tipo,
        product.marca,
        product.laboratorio,
        product.registroInvima,
        product.claseRiesgo,
        batch.numeroLote,
        stock.bodega.nombre,
      ].some((field) =>
        String(field ?? "")
          .toLowerCase()
          .includes(value),
      ),
    );
  }, [rows, search]);

  const activeProducts = useMemo(
    () => products.filter((product) => product.estado === "ACTIVO"),
    [products],
  );

  const availableWarehouses = warehouses.filter(
    (warehouse) => warehouse.permiteDispensacion,
  );

  const totalUnits = rows.reduce((total, row) => total + row.stock.cantidad, 0);

  const enabledWarehouseUnits = rows.reduce(
    (total, row) => total + (row.available ? row.stock.cantidad : 0),
    0,
  );

  const nonConformingUnits = rows.reduce(
    (total, row) =>
      total + (!row.stock.bodega.permiteDispensacion ? row.stock.cantidad : 0),
    0,
  );

  const validDraftRows = receiptRows.filter(
    (row) =>
      row.productoId !== "" ||
      row.codigo.trim() !== "" ||
      row.numeroLote.trim() !== "" ||
      row.fechaVencimiento !== "" ||
      row.cantidad.trim() !== "" ||
      row.costoUnitario.trim() !== "" ||
      row.temperaturaRegistrada.trim() !== "" ||
      row.humedadRegistrada.trim() !== "" ||
      row.observacionesVerificacion.trim() !== "",
  );

  const receiptTotalUnits = validDraftRows.reduce(
    (total, row) =>
      total + (Number(row.cantidad) > 0 ? Number(row.cantidad) : 0),
    0,
  );

  const receiptTotalValue = validDraftRows.reduce(
    (total, row) =>
      total +
      (Number(row.cantidad) > 0 ? Number(row.cantidad) : 0) *
        (Number(row.costoUnitario) || 0),
    0,
  );

  const receiptConformingUnits = validDraftRows.reduce(
    (total, row) =>
      total +
      (row.resultadoVerificacion === "CONFORME"
        ? Math.max(0, Number(row.cantidad) || 0)
        : 0),
    0,
  );

  const receiptPendingUnits = validDraftRows.reduce(
    (total, row) =>
      total +
      (row.resultadoVerificacion === "PENDIENTE"
        ? Math.max(0, Number(row.cantidad) || 0)
        : 0),
    0,
  );

  const receiptNonConformingUnits = validDraftRows.reduce(
    (total, row) =>
      total +
      (row.resultadoVerificacion === "NO_CONFORME"
        ? Math.max(0, Number(row.cantidad) || 0)
        : 0),
    0,
  );

  const updateReceiptField = (field: keyof ReceiptForm, value: string) => {
    setReceiptForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setFormError("");
  };

  const updateRow = <K extends keyof ReceiptRow>(
    id: number,
    field: K,
    value: ReceiptRow[K],
  ) => {
    setReceiptRows((previous) =>
      previous.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );

    setFormError("");
  };

  const findProductByCode = (code: string) => {
    const value = code.trim().toLowerCase();

    if (!value) return undefined;

    return activeProducts.find(
      (product) =>
        String(product.codigoInterno).toLowerCase() === value ||
        product.codigoBarras?.trim().toLowerCase() === value,
    );
  };

  const changeRowCode = (id: number, code: string) => {
    const match = findProductByCode(code);

    setReceiptRows((previous) =>
      previous.map((row) =>
        row.id === id
          ? {
              ...row,
              codigo: code,
              productoId: match ? String(match.id) : "",
              estadoVerificacionInvima:
                match && match.tipo === "INSUMO" && !match.registroInvima
                  ? "NO_APLICA"
                  : row.estadoVerificacionInvima,
            }
          : row,
      ),
    );

    setFormError("");
  };

  const chooseRowProduct = (id: number, productId: string) => {
    const product = activeProducts.find(
      (item) => item.id === Number(productId),
    );

    setReceiptRows((previous) =>
      previous.map((row) =>
        row.id === id
          ? {
              ...row,
              productoId: productId,
              codigo: product ? String(product.codigoInterno) : "",
              estadoVerificacionInvima:
                product && product.tipo === "INSUMO" && !product.registroInvima
                  ? "NO_APLICA"
                  : row.estadoVerificacionInvima,
            }
          : row,
      ),
    );

    setFormError("");
  };

  const addRow = () => {
    setReceiptRows((previous) => [
      ...previous,
      createEmptyRow(nextRowId.current++),
    ]);

    setFormError("");
  };

  const removeRow = (id: number) => {
    setReceiptRows((previous) =>
      previous.length === 1
        ? [createEmptyRow(nextRowId.current++)]
        : previous.filter((row) => row.id !== id),
    );

    setFormError("");
  };

  const resetReceipt = () => {
    setReceiptForm({ ...emptyReceiptForm });
    setReceiptRows([createEmptyRow(nextRowId.current++)]);
    setFormError("");
    setReceiptResult(null);
  };

  const openModule = (module: InventoryModule) => {
    if (
      !module.enabled ||
      !visibleModules.some((item) => item.id === module.id)
    )
      return;

    if (module.id === "products") {
      goToSection("products");
      setSearch("");
    }

    if (module.id === "entry") {
      if (!canManageInventory) return;
      resetReceipt();
      goToSection("entry");
    }

    if (module.id === "receipts") {
      goToSection("receipts");
    }

    if (module.id === "transfer") {
      goToSection("transfer");
    }

    if (module.id === "adjustment") {
      if (!canManageInventory) return;
      goToSection("adjustment");
    }

    if (module.id === "expiration") {
      goToSection("expiration");
    }

    if (module.id === "warehouses") {
      if (!canManageInventory) return;
      goToSection("warehouses");
    }

    if (module.id === "movements") {
      navigate("/inventory/movements");
    }
  };

  const updateSupplierField = (
    field: keyof CreateInventorySupplier,
    value: string,
  ) => {
    setSupplierForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setSupplierError("");
  };

  const submitSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (supplierSaving) return;

    const nit = supplierForm.nit.trim();
    const razonSocial = supplierForm.razonSocial.trim();

    if (!nit || !razonSocial) {
      setSupplierError("El NIT y la razón social son obligatorios.");
      return;
    }

    setSupplierSaving(true);
    setSupplierError("");

    try {
      const created = await createInventorySupplier({
        nit,
        razonSocial,
        nombreComercial: supplierForm.nombreComercial?.trim() || undefined,
        telefono: supplierForm.telefono?.trim() || undefined,
        correo: supplierForm.correo?.trim() || undefined,
        direccion: supplierForm.direccion?.trim() || undefined,
        contacto: supplierForm.contacto?.trim() || undefined,
      });

      setSuppliers((previous) =>
        [...previous.filter((item) => item.id !== created.id), created].sort(
          (a, b) => a.razonSocial.localeCompare(b.razonSocial, "es"),
        ),
      );

      setReceiptForm((previous) => ({
        ...previous,
        proveedorId: String(created.id),
      }));

      setSupplierModalOpen(false);
      setSupplierForm(emptySupplierForm());
    } catch (err) {
      setSupplierError(
        err instanceof Error
          ? err.message
          : "No fue posible registrar el proveedor.",
      );
    } finally {
      setSupplierSaving(false);
    }
  };

  const updateNewProductField = <K extends keyof NewProductForm>(
    field: K,
    value: NewProductForm[K],
  ) => {
    setNewProductForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setNewProductError("");
  };

  const openProductModal = (rowId: number) => {
    setProductTargetRowId(rowId);
    setNewProductForm(emptyNewProductForm());
    setNewProductError("");
    setProductModalOpen(true);
  };

  const submitNewProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (productSaving) return;

    setNewProductError("");

    const form = newProductForm;

    const descripcion =
      form.tipo === "MEDICAMENTO"
        ? [
            form.nombre.trim(),
            form.concentracion.trim(),
            form.formaFarmaceutica.trim(),
          ]
            .filter(Boolean)
            .join(" ")
        : form.descripcion.trim();

    if (
      form.tipo === "MEDICAMENTO" &&
      (!form.nombre.trim() ||
        !form.concentracion.trim() ||
        !form.formaFarmaceutica.trim())
    ) {
      setNewProductError(
        "Completa el nombre, concentración y forma farmacéutica.",
      );
      return;
    }

    if (!descripcion) {
      setNewProductError("La descripción del producto es obligatoria.");
      return;
    }

    if (form.tipo === "DISPOSITIVO_MEDICO" && !form.claseRiesgo) {
      setNewProductError(
        "Selecciona la clase de riesgo del dispositivo médico.",
      );
      return;
    }

    const payload: CreateInventoryProduct = {
      tipo: form.tipo,
      descripcion,
      marca: form.marca.trim() || undefined,
      laboratorio: form.laboratorio.trim() || undefined,
      registroInvima: form.registroInvima.trim() || undefined,
      condicionConservacion: form.condicionConservacion,
      claseRiesgo:
        form.tipo === "DISPOSITIVO_MEDICO" ? form.claseRiesgo : undefined,
    };

    if (form.tipo === "MEDICAMENTO") {
      payload.medicamento = {
        nombre: form.nombre.trim(),
        concentracion: form.concentracion.trim(),
        formaFarmaceutica: form.formaFarmaceutica.trim(),
      };
    }

    setProductSaving(true);

    try {
      const previousIds = new Set(products.map((product) => product.id));

      const created = await createInventoryProduct(payload);

      const result = created as unknown as {
        id?: number;
        producto?: { id?: number };
        productoInventario?: { id?: number };
      };

      const createdId =
        result.id ?? result.producto?.id ?? result.productoInventario?.id;

      const catalog = await getInventoryProducts();
      setProducts(catalog.productos);

      const match =
        catalog.productos.find((product) => product.id === createdId) ??
        catalog.productos.find(
          (product) =>
            !previousIds.has(product.id) && product.descripcion === descripcion,
        );

      if (!match) {
        setNewProductError(
          "El producto se creó, pero no apareció en el catálogo. Actualiza el inventario antes de continuar.",
        );
        return;
      }

      if (productTargetRowId !== null) {
        setReceiptRows((previous) =>
          previous.map((row) =>
            row.id === productTargetRowId
              ? {
                  ...row,
                  productoId: String(match.id),
                  codigo: String(match.codigoInterno),
                  estadoVerificacionInvima:
                    match.tipo === "INSUMO" && !match.registroInvima
                      ? "NO_APLICA"
                      : "PENDIENTE",
                }
              : row,
          ),
        );
      }

      setProductModalOpen(false);
      setProductTargetRowId(null);
      setNewProductForm(emptyNewProductForm());
      setFormError("");
    } catch (err) {
      setNewProductError(
        err instanceof Error
          ? err.message
          : "No fue posible registrar el producto.",
      );
    } finally {
      setProductSaving(false);
    }
  };

  const validateReceiptRows = (): InventoryReceiptItem[] | null => {
    const populated = validDraftRows;

    if (!populated.length) {
      setFormError("Agrega al menos un producto antes de confirmar.");
      return null;
    }

    const seen = new Set<string>();
    const items: InventoryReceiptItem[] = [];

    for (const row of populated) {
      const number = receiptRows.findIndex((item) => item.id === row.id) + 1;

      const product = activeProducts.find(
        (item) => item.id === Number(row.productoId),
      );

      if (!product) {
        setFormError(
          `Fila ${number}: selecciona un producto válido del catálogo.`,
        );
        return null;
      }

      const numeroLote = row.numeroLote.trim();

      if (!numeroLote) {
        setFormError(`Fila ${number}: ingresa el número de lote.`);
        return null;
      }

      if (!row.fechaVencimiento) {
        setFormError(`Fila ${number}: ingresa la fecha de vencimiento.`);
        return null;
      }

      if (row.fechaVencimiento < todayColombia()) {
        setFormError(`Fila ${number}: no puedes ingresar un lote vencido.`);
        return null;
      }

      const cantidad = Number(row.cantidad);

      if (
        !row.cantidad.trim() ||
        !Number.isInteger(cantidad) ||
        cantidad <= 0
      ) {
        setFormError(
          `Fila ${number}: la cantidad debe ser un entero mayor que cero.`,
        );
        return null;
      }

      if (
        row.costoUnitario.trim() &&
        (!Number.isFinite(Number(row.costoUnitario)) ||
          Number(row.costoUnitario) < 0)
      ) {
        setFormError(`Fila ${number}: el costo unitario no es válido.`);
        return null;
      }

      const existingBatch = product.lotes.find(
        (batch) =>
          batch.numeroLote.trim().toLowerCase() === numeroLote.toLowerCase(),
      );

      if (
        existingBatch &&
        existingBatch.fechaVencimiento.slice(0, 10) !== row.fechaVencimiento
      ) {
        setFormError(
          `Fila ${number}: el lote ${numeroLote} ya existe con vencimiento ${formatDate(existingBatch.fechaVencimiento)}.`,
        );
        return null;
      }

      const key = `${product.id}|${numeroLote.toLowerCase()}`;

      if (seen.has(key)) {
        setFormError(
          `Fila ${number}: este producto y lote ya aparecen en otra fila.`,
        );
        return null;
      }

      seen.add(key);

      if (
        row.temperaturaRegistrada.trim() &&
        !Number.isFinite(Number(row.temperaturaRegistrada))
      ) {
        setFormError(`Fila ${number}: la temperatura no es válida.`);
        return null;
      }

      if (
        row.humedadRegistrada.trim() &&
        (!Number.isFinite(Number(row.humedadRegistrada)) ||
          Number(row.humedadRegistrada) < 0 ||
          Number(row.humedadRegistrada) > 100)
      ) {
        setFormError(`Fila ${number}: la humedad debe estar entre 0 y 100 %.`);
        return null;
      }

      if (row.resultadoVerificacion === "CONFORME") {
        if (
          row.estadoVerificacionInvima !== "VIGENTE" &&
          row.estadoVerificacionInvima !== "NO_APLICA"
        ) {
          setFormError(
            `Fila ${number}: para marcar conforme, INVIMA debe estar vigente o no aplicar.`,
          );
          return null;
        }

        if (
          row.estadoVerificacionInvima === "VIGENTE" &&
          !product.registroInvima?.trim()
        ) {
          setFormError(
            `Fila ${number}: registra el número INVIMA del producto en el catálogo antes de marcarlo como vigente.`,
          );
          return null;
        }

        const requiresTemperature =
          product.condicionConservacion === "CADENA_FRIO" ||
          product.condicionConservacion === "OTRA" ||
          product.temperaturaMinima !== null ||
          product.temperaturaMaxima !== null;

        if (requiresTemperature && !row.temperaturaRegistrada.trim()) {
          setFormError(
            `Fila ${number}: registra la temperatura para verificar este producto.`,
          );
          return null;
        }

        const temperature = Number(row.temperaturaRegistrada);

        if (
          row.temperaturaRegistrada.trim() &&
          ((product.temperaturaMinima !== null &&
            temperature < product.temperaturaMinima) ||
            (product.temperaturaMaxima !== null &&
              temperature > product.temperaturaMaxima))
        ) {
          setFormError(
            `Fila ${number}: temperatura fuera del rango configurado; no marques conforme.`,
          );
          return null;
        }

        if (product.humedadMaxima !== null && !row.humedadRegistrada.trim()) {
          setFormError(
            `Fila ${number}: registra la humedad para verificar la conservación.`,
          );
          return null;
        }

        if (
          product.humedadMaxima !== null &&
          row.humedadRegistrada.trim() &&
          Number(row.humedadRegistrada) > product.humedadMaxima
        ) {
          setFormError(
            `Fila ${number}: la humedad supera el máximo configurado.`,
          );
          return null;
        }
      }

      const item: InventoryReceiptItem = {
        productoId: product.id,
        numeroLote,
        fechaVencimiento: row.fechaVencimiento,
        cantidad,
        estadoVerificacionInvima: row.estadoVerificacionInvima,
        resultadoVerificacion: row.resultadoVerificacion,
      };

      if (row.costoUnitario.trim()) {
        item.costoUnitario = Number(row.costoUnitario);
      }

      if (row.temperaturaRegistrada.trim()) {
        item.temperaturaRegistrada = Number(row.temperaturaRegistrada);
      }

      if (row.humedadRegistrada.trim()) {
        item.humedadRegistrada = Number(row.humedadRegistrada);
      }

      if (row.observacionesVerificacion.trim()) {
        item.observacionesVerificacion = row.observacionesVerificacion.trim();
      }

      items.push(item);
    }

    return items;
  };

  const submitReceipt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) return;

    setFormError("");

    if (
      !receiptForm.numeroFactura.trim() ||
      !receiptForm.fechaFactura ||
      !receiptForm.proveedorId ||
      !receiptForm.bodegaDestinoId
    ) {
      setFormError("Completa los datos obligatorios de la factura.");
      return;
    }

    if (
      !availableWarehouses.some(
        (warehouse) => warehouse.id === Number(receiptForm.bodegaDestinoId),
      )
    ) {
      setFormError("Selecciona una bodega de recepción válida.");
      return;
    }

    const items = validateReceiptRows();

    if (!items) return;

    const total = items.reduce((sum, item) => sum + item.cantidad, 0);

    const conformes = items
      .filter((item) => item.resultadoVerificacion === "CONFORME")
      .reduce((sum, item) => sum + item.cantidad, 0);

    const pendientes = items
      .filter((item) => item.resultadoVerificacion === "PENDIENTE")
      .reduce((sum, item) => sum + item.cantidad, 0);

    const noConformes = items
      .filter((item) => item.resultadoVerificacion === "NO_CONFORME")
      .reduce((sum, item) => sum + item.cantidad, 0);

    const confirmed = window.confirm(
      `¿Confirmas la recepción de ${total} unidades de la factura ${receiptForm.numeroFactura.trim()}?\n\n` +
        `Conformes: ${conformes}\n` +
        `Pendientes: ${pendientes}\n` +
        `No conformes: ${noConformes}\n\n` +
        "Solo las unidades conformes podrán actualizar las existencias disponibles.",
    );

    if (!confirmed) return;

    setSaving(true);
    setReceiptResult(null);

    try {
      const result = await createInventoryReceipt({
        numeroFactura: receiptForm.numeroFactura.trim(),
        fechaFactura: receiptForm.fechaFactura,
        proveedorId: Number(receiptForm.proveedorId),
        bodegaDestinoId: Number(receiptForm.bodegaDestinoId),
        observaciones: receiptForm.observaciones.trim() || undefined,
        productos: items,
      });

      setReceiptResult(result);
      setReceiptForm({ ...emptyReceiptForm });
      setReceiptRows([createEmptyRow(nextRowId.current++)]);

      await loadInventory();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "No fue posible registrar el ingreso.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="inventory-page">
      <header className="inventory-header">
        <div>
          <span className="inventory-section-label">
            SISTEMA 007 / INVENTARIO
          </span>

          <h1>
            {section === "home"
              ? "Gestión de inventario"
              : section === "products"
                ? "Productos y existencias"
                : section === "receipts"
                  ? "Seguimiento de recepciones"
                  : section === "transfer"
                    ? "Traslados de inventario"
                    : section === "adjustment"
                      ? "Ajustes de inventario"
                      : section === "expiration"
                        ? "Vencimientos de inventario"
                        : section === "warehouses"
                          ? "Configuración de bodegas"
                          : "Ingreso de productos"}
          </h1>

          <p>
            {section === "home"
              ? "Administra y controla los procesos del inventario farmacéutico."
              : section === "products"
                ? "Consulta los productos, lotes y existencias por bodega."
                : section === "receipts"
                  ? "Consulta las facturas registradas y el resultado de su verificación técnica."
                  : section === "transfer"
                    ? "Traslada existencias entre bodegas con control de lotes y cantidades."
                    : section === "adjustment"
                      ? "Registra conteos físicos, identifica diferencias y realiza ajustes justificados con trazabilidad."
                      : section === "expiration"
                        ? "Consulta los lotes vencidos y próximos a vencer y gestiona sus existencias."
                        : section === "warehouses"
                          ? "Consulta, registra y administra las bodegas disponibles para operaciones nuevas."
                          : "Registra la recepción y verificación técnica de medicamentos e insumos mediante factura física."}
          </p>
        </div>

        <button
          type="button"
          className="inventory-back-button"
          onClick={() =>
            section === "home" ? navigate("/dashboard") : goToSection("home")
          }
        >
          {section === "home" ? "Volver al panel" : "Volver a Inventario"}
        </button>
      </header>

      {section === "home" && (
        <>
          <section className="inventory-overview">
            <div className="inventory-overview-heading">
              <span className="inventory-eyebrow">RESUMEN GENERAL</span>
              <h2>Estado del inventario</h2>
              <p>Información actual de los productos registrados.</p>
            </div>

            {error && <div className="inventory-message">{error}</div>}

            <div className="inventory-stats-grid">
              <article className="inventory-stat-card">
                <span>Productos registrados</span>
                <strong>{loading ? "—" : products.length}</strong>
                <small>Medicamentos e insumos</small>
              </article>

              <article className="inventory-stat-card">
                <span>Unidades registradas</span>
                <strong>{loading ? "—" : totalUnits}</strong>
                <small>Existencias actuales en bodegas</small>
              </article>

              <article className="inventory-stat-card">
                <span>Unidades disponibles</span>
                <strong>{loading ? "—" : enabledWarehouseUnits}</strong>
                <small>En bodegas habilitadas</small>
              </article>

              <article className="inventory-stat-card">
                <span>Unidades no conformes</span>
                <strong>{loading ? "—" : nonConformingUnits}</strong>
                <small>En bodegas no habilitadas</small>
              </article>
            </div>
          </section>

          <section className="inventory-operations">
            <div className="inventory-operations-heading">
              <h2>Operaciones de inventario</h2>
              <p>Selecciona el proceso que deseas realizar.</p>
            </div>

            <div className="inventory-modules-grid">
              {visibleModules.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  className={`inventory-module-card ${
                    !module.enabled ? "inventory-module-disabled" : ""
                  }`}
                  onClick={() => openModule(module)}
                  disabled={!module.enabled}
                >
                  <span className="inventory-module-icon">
                    <InventoryIcon name={module.icon} />
                  </span>

                  <span className="inventory-module-information">
                    <strong>{module.title}</strong>
                    <small>{module.description}</small>
                  </span>

                  <span
                    className={`inventory-module-status ${
                      module.enabled ? "inventory-module-ready" : ""
                    }`}
                  >
                    {module.enabled ? "Ingresar" : "Por integrar"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {allowedModules.has("receipts") && section === "receipts" && (
        <InventoryReceipts />
      )}

      {allowedModules.has("transfer") && section === "transfer" && (
        <InventoryTransfers onSuccess={loadInventory} />
      )}

      {allowedModules.has("adjustment") && section === "adjustment" && (
        <InventoryAdjustments onSuccess={loadInventory} />
      )}

      {allowedModules.has("expiration") && section === "expiration" && (
        <InventoryExpirations onSuccess={loadInventory} />
      )}

      {canManageWarehouses && section === "warehouses" && <InventoryWarehouses />}

      {section === "products" && (
        <section className="inventory-content">
          <div className="inventory-toolbar">
            <div>
              <h2>Catálogo de productos</h2>
              <span>{products.length} productos registrados</span>
            </div>
          </div>

          <div className="inventory-search-container">
            <label htmlFor="inventory-search">Buscar producto</label>

            <input
              id="inventory-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Producto, código, lote, INVIMA o bodega"
            />
          </div>

          {loading && (
            <div className="inventory-message">Cargando inventario...</div>
          )}

          {error && <div className="inventory-message">{error}</div>}

          {!loading && !error && filteredRows.length === 0 && (
            <div className="inventory-empty">
              <h3>No se encontraron productos</h3>
              <p>No existen registros que coincidan con la búsqueda.</p>
            </div>
          )}

          {!loading && !error && filteredRows.length > 0 && (
            <div className="inventory-table-container">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Tipo</th>
                    <th>Registro INVIMA</th>
                    <th>Clase de riesgo</th>
                    <th>Lote</th>
                    <th>Vencimiento</th>
                    <th>Bodega</th>
                    <th>Existencia</th>
                    <th>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.product.codigoInterno}</td>

                      <td>
                        <strong className="inventory-product-name">
                          {row.product.descripcion}
                        </strong>
                        <small>
                          {row.product.laboratorio || "Sin laboratorio"}
                        </small>
                      </td>

                      <td>
                        {row.product.tipo === "DISPOSITIVO_MEDICO"
                          ? "Dispositivo médico"
                          : row.product.tipo === "MEDICAMENTO"
                            ? "Medicamento"
                            : "Insumo"}
                      </td>

                      <td>{row.product.registroInvima || "Sin registrar"}</td>

                      <td>
                        {isMedicalDevice(row.product)
                          ? row.product.claseRiesgo
                            ? `Clase ${row.product.claseRiesgo}`
                            : "Sin registrar"
                          : "—"}
                      </td>

                      <td>{row.batch.numeroLote}</td>
                      <td>{formatDate(row.batch.fechaVencimiento)}</td>
                      <td>{row.stock.bodega.nombre}</td>

                      <td>
                        <strong>{row.stock.cantidad}</strong>
                      </td>

                      <td>
                        <span
                          className={`inventory-status ${
                            row.available
                              ? "inventory-status-available"
                              : "inventory-status-unavailable"
                          }`}
                        >
                          {row.expired
                            ? "Vencido"
                            : row.available
                              ? "Disponible"
                              : "No disponible"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {(canManageInventory || userRole === "ADMINISTRADOR") && section === "entry" && (
        <section className="inventory-content inventory-entry-content">
          <div className="inventory-toolbar inventory-entry-toolbar">
            <div>
              <h2>Recepción por factura</h2>
              <span>Completa la factura y registra cada lote en una fila.</span>
            </div>
          </div>

          {catalogLoading && (
            <div className="inventory-message">
              Cargando proveedores y bodegas...
            </div>
          )}

          {catalogError && (
            <div className="inventory-receipt-error">{catalogError}</div>
          )}

          {error && <div className="inventory-receipt-error">{error}</div>}

          {receiptResult && (
            <div className="inventory-receipt-success" role="status">
              <h3>
                {receiptResult.numeroIngreso
                  ? "Ingreso registrado correctamente"
                  : "Recepción registrada correctamente"}
              </h3>

              {receiptResult.numeroIngreso ? (
                <p>
                  Número de ingreso:{" "}
                  <strong>{receiptResult.numeroIngreso}</strong>
                </p>
              ) : (
                <p>
                  La recepción quedó registrada, pero no se generó un ingreso de
                  existencias porque no hay productos conformes.
                </p>
              )}

              <div className="inventory-receipt-success-details">
                <span>
                  <strong>Factura:</strong> {receiptResult.numeroFactura}
                </span>

                <span>
                  <strong>Proveedor:</strong> {receiptResult.proveedor}
                </span>

                <span>
                  <strong>Bodega:</strong> {receiptResult.bodegaDestino}
                </span>

                <span>
                  <strong>Estado:</strong> {receiptResult.estado}
                </span>

                <span>
                  <strong>Conformes:</strong> {receiptResult.totalConformes}
                </span>

                <span>
                  <strong>Pendientes:</strong> {receiptResult.totalPendientes}
                </span>

                <span>
                  <strong>No conformes:</strong>{" "}
                  {receiptResult.totalNoConformes}
                </span>
              </div>

              <p>
                Solo los productos conformes se incorporan a las existencias
                disponibles.
              </p>
            </div>
          )}

          <form onSubmit={submitReceipt} className="inventory-entry-form">
            <div className="inventory-entry-header">
              <div className="inventory-entry-section-title">
                <h3>Datos de la factura</h3>
                <span>Información general</span>
              </div>

              <div className="inventory-entry-fields">
                <div className="inventory-receipt-field">
                  <label htmlFor="receipt-number">Número de factura</label>

                  <input
                    id="receipt-number"
                    type="text"
                    value={receiptForm.numeroFactura}
                    onChange={(event) =>
                      updateReceiptField("numeroFactura", event.target.value)
                    }
                    placeholder="Ej. FAC-001"
                    maxLength={100}
                    required
                  />
                </div>

                <div className="inventory-receipt-field">
                  <label htmlFor="receipt-date">Fecha de factura</label>

                  <input
                    id="receipt-date"
                    type="date"
                    value={receiptForm.fechaFactura}
                    onChange={(event) =>
                      updateReceiptField("fechaFactura", event.target.value)
                    }
                    required
                  />
                </div>

                <div className="inventory-receipt-field">
                  <div className="inventory-entry-label-line">
                    <label htmlFor="receipt-supplier">Proveedor</label>

                    <button
                      type="button"
                      className="inventory-entry-text-action"
                      onClick={() => {
                        setSupplierForm(emptySupplierForm());
                        setSupplierError("");
                        setSupplierModalOpen(true);
                      }}
                    >
                      + Nuevo
                    </button>
                  </div>

                  <select
                    id="receipt-supplier"
                    value={receiptForm.proveedorId}
                    onChange={(event) =>
                      updateReceiptField("proveedorId", event.target.value)
                    }
                    required
                  >
                    <option value="">Seleccionar proveedor</option>

                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.razonSocial} - {supplier.nit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inventory-receipt-field">
                  <label htmlFor="receipt-warehouse">Bodega de destino</label>

                  <select
                    id="receipt-warehouse"
                    value={receiptForm.bodegaDestinoId}
                    onChange={(event) =>
                      updateReceiptField("bodegaDestinoId", event.target.value)
                    }
                    required
                  >
                    <option value="">Seleccionar bodega</option>

                    {availableWarehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.nombre} - {warehouse.sede.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inventory-receipt-field inventory-entry-observations">
                  <label htmlFor="receipt-observations">
                    Observaciones generales (opcional)
                  </label>

                  <input
                    id="receipt-observations"
                    type="text"
                    value={receiptForm.observaciones}
                    onChange={(event) =>
                      updateReceiptField("observaciones", event.target.value)
                    }
                    placeholder="Novedades generales de la factura"
                  />
                </div>
              </div>
            </div>

            <div className="inventory-entry-detail">
              <div className="inventory-entry-detail-heading">
                <div>
                  <h3>Detalle de recepción</h3>
                  <p>
                    Escribe el código o selecciona el producto. Registra cada
                    lote en su propia fila.
                  </p>
                </div>

                <button
                  type="button"
                  className="inventory-receipt-add"
                  onClick={addRow}
                  disabled={saving}
                >
                  + Agregar fila
                </button>
              </div>

              <div className="inventory-entry-table-scroll">
                <table className="inventory-entry-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Producto</th>
                      <th>Lote</th>
                      <th>Vencimiento</th>
                      <th>Cantidad</th>
                      <th>Costo unit.</th>
                      <th>Número INVIMA</th>
                      <th>Estado INVIMA</th>
                      <th>Clase de riesgo</th>
                      <th>Temp. °C</th>
                      <th>Humedad %</th>
                      <th>Verificación</th>
                      <th>Observaciones</th>
                      <th>Acción</th>
                    </tr>
                  </thead>

                  <tbody>
                    {receiptRows.map((row, index) => {
                      const selectedProduct = activeProducts.find(
                        (product) => product.id === Number(row.productoId),
                      );

                      const suggestions =
                        row.codigo.trim() && !selectedProduct
                          ? activeProducts
                              .filter((product) =>
                                [
                                  product.codigoInterno,
                                  product.codigoBarras,
                                  product.descripcion,
                                  product.marca,
                                  product.laboratorio,
                                ].some((value) =>
                                  String(value ?? "")
                                    .toLowerCase()
                                    .includes(row.codigo.trim().toLowerCase()),
                                ),
                              )
                              .slice(0, 15)
                          : [];

                      const existingBatch = selectedProduct?.lotes.find(
                        (batch) =>
                          batch.numeroLote.trim().toLowerCase() ===
                          row.numeroLote.trim().toLowerCase(),
                      );

                      const medicalDevice = selectedProduct
                        ? isMedicalDevice(selectedProduct)
                        : false;

                      const invimaNumber = selectedProduct
                        ? selectedProduct.registroInvima?.trim() ||
                          "Sin registrar"
                        : "";

                      return (
                        <tr key={row.id}>
                          <td>
                            <input
                              className="inventory-entry-code"
                              aria-label={`Código fila ${index + 1}`}
                              value={row.codigo}
                              onChange={(event) =>
                                changeRowCode(row.id, event.target.value)
                              }
                              placeholder="Código"
                              list={`product-codes-${row.id}`}
                              autoComplete="off"
                            />

                            <datalist id={`product-codes-${row.id}`}>
                              {activeProducts.map((product) => (
                                <option
                                  key={product.id}
                                  value={String(product.codigoInterno)}
                                >
                                  {product.descripcion}
                                </option>
                              ))}
                            </datalist>
                          </td>

                          <td>
                            <div className="inventory-entry-product-cell">
                              <select
                                aria-label={`Producto fila ${index + 1}`}
                                value={row.productoId}
                                onChange={(event) =>
                                  chooseRowProduct(row.id, event.target.value)
                                }
                              >
                                <option value="">Seleccionar producto</option>

                                {selectedProduct && (
                                  <option value={selectedProduct.id}>
                                    {selectedProduct.descripcion}
                                  </option>
                                )}

                                {(suggestions.length
                                  ? suggestions
                                  : !row.codigo.trim()
                                    ? activeProducts
                                    : []
                                )
                                  .filter(
                                    (product) =>
                                      product.id !== selectedProduct?.id,
                                  )
                                  .map((product) => (
                                    <option key={product.id} value={product.id}>
                                      {product.codigoInterno} -{" "}
                                      {product.descripcion}
                                    </option>
                                  ))}
                              </select>

                              <button
                                type="button"
                                className="inventory-entry-new-product"
                                onClick={() => openProductModal(row.id)}
                                disabled={saving}
                                title="Registrar un producto nuevo"
                              >
                                + Nuevo producto
                              </button>

                              {selectedProduct && (
                                <small
                                  title={`Conservación: ${selectedProduct.condicionConservacion}`}
                                >
                                  {selectedProduct.laboratorio ||
                                    "Sin laboratorio"}
                                </small>
                              )}

                              {row.codigo.trim() &&
                                !selectedProduct &&
                                suggestions.length === 0 && (
                                  <small className="inventory-entry-not-found">
                                    Código no encontrado
                                  </small>
                                )}
                            </div>
                          </td>

                          <td>
                            <input
                              className="inventory-entry-lot"
                              aria-label={`Lote fila ${index + 1}`}
                              value={row.numeroLote}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "numeroLote",
                                  event.target.value,
                                )
                              }
                              placeholder="Lote"
                              title={
                                existingBatch
                                  ? `Lote existente. Vence ${formatDate(
                                      existingBatch.fechaVencimiento,
                                    )}`
                                  : ""
                              }
                            />
                          </td>

                          <td>
                            <input
                              className="inventory-entry-date"
                              type="date"
                              aria-label={`Vencimiento fila ${index + 1}`}
                              value={row.fechaVencimiento}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "fechaVencimiento",
                                  event.target.value,
                                )
                              }
                            />
                          </td>

                          <td>
                            <input
                              className="inventory-entry-small-number"
                              type="number"
                              min="1"
                              step="1"
                              aria-label={`Cantidad fila ${index + 1}`}
                              value={row.cantidad}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "cantidad",
                                  event.target.value,
                                )
                              }
                              placeholder="0"
                            />
                          </td>

                          <td>
                            <input
                              className="inventory-entry-cost"
                              type="number"
                              min="0"
                              step="0.01"
                              aria-label={`Costo unitario fila ${index + 1}`}
                              value={row.costoUnitario}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "costoUnitario",
                                  event.target.value,
                                )
                              }
                              placeholder="Opcional"
                            />
                          </td>

                          <td>
                            <input
                              type="text"
                              readOnly
                              aria-label={`Número INVIMA fila ${index + 1}`}
                              value={invimaNumber}
                              title={
                                selectedProduct
                                  ? invimaNumber
                                  : "Número de registro INVIMA del producto"
                              }
                              style={{
                                minWidth: "150px",
                                width: "100%",
                                background: "#f3f6f9",
                                color: "#34465a",
                                cursor: "default",
                              }}
                            />
                          </td>

                          <td>
                            <select
                              className="inventory-entry-status-select"
                              aria-label={`Estado INVIMA fila ${index + 1}`}
                              value={row.estadoVerificacionInvima}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "estadoVerificacionInvima",
                                  event.target.value as InventoryInvimaStatus,
                                )
                              }
                            >
                              <option value="PENDIENTE">Pendiente</option>
                              <option value="VIGENTE">Vigente</option>
                              <option value="NO_VIGENTE">No vigente</option>
                              <option value="NO_APLICA">No aplica</option>
                            </select>
                          </td>

                          <td>
                            {medicalDevice ? (
                              <input
                                type="text"
                                readOnly
                                aria-label={`Clase de riesgo fila ${index + 1}`}
                                value={
                                  selectedProduct?.claseRiesgo
                                    ? `Clase ${selectedProduct.claseRiesgo}`
                                    : "Sin registrar"
                                }
                                style={{
                                  minWidth: "120px",
                                  width: "100%",
                                  background: "#f3f6f9",
                                  color: "#34465a",
                                  cursor: "default",
                                }}
                              />
                            ) : (
                              <span
                                style={{
                                  display: "block",
                                  textAlign: "center",
                                  color: "#8793a3",
                                  fontSize: "13px",
                                }}
                              >
                                {selectedProduct ? "—" : ""}
                              </span>
                            )}
                          </td>

                          <td>
                            <input
                              className="inventory-entry-measure"
                              type="number"
                              step="any"
                              aria-label={`Temperatura fila ${index + 1}`}
                              value={row.temperaturaRegistrada}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "temperaturaRegistrada",
                                  event.target.value,
                                )
                              }
                              placeholder="°C"
                            />
                          </td>

                          <td>
                            <input
                              className="inventory-entry-measure"
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              aria-label={`Humedad fila ${index + 1}`}
                              value={row.humedadRegistrada}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "humedadRegistrada",
                                  event.target.value,
                                )
                              }
                              placeholder="%"
                            />
                          </td>

                          <td>
                            <select
                              className="inventory-entry-status-select"
                              aria-label={`Verificación fila ${index + 1}`}
                              value={row.resultadoVerificacion}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "resultadoVerificacion",
                                  event.target
                                    .value as InventoryVerificationResult,
                                )
                              }
                            >
                              <option value="PENDIENTE">Pendiente</option>
                              <option value="CONFORME">Conforme</option>
                              <option value="NO_CONFORME">No conforme</option>
                            </select>
                          </td>

                          <td>
                            <input
                              className="inventory-entry-notes"
                              aria-label={`Observaciones fila ${index + 1}`}
                              value={row.observacionesVerificacion}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "observacionesVerificacion",
                                  event.target.value,
                                )
                              }
                              placeholder="Opcional"
                            />
                          </td>

                          <td>
                            <button
                              type="button"
                              className="inventory-receipt-remove inventory-entry-remove"
                              onClick={() => removeRow(row.id)}
                              disabled={saving}
                              title="Quitar fila"
                              aria-label={`Quitar fila ${index + 1}`}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="inventory-entry-table-bottom">
                <span>
                  Los productos pendientes o no conformes no aumentan las
                  existencias disponibles.
                </span>
              </div>
            </div>

            <div className="inventory-entry-bottom">
              <div className="inventory-entry-totals">
                <span>
                  <strong>{validDraftRows.length}</strong> lotes
                </span>

                <span>
                  <strong>{receiptTotalUnits}</strong> unidades
                </span>

                <span>
                  <strong>{receiptConformingUnits}</strong> conformes
                </span>

                <span>
                  <strong>{receiptPendingUnits}</strong> pendientes
                </span>

                <span>
                  <strong>{receiptNonConformingUnits}</strong> no conformes
                </span>

                <span>
                  Valor: <strong>{formatMoney(receiptTotalValue)}</strong>
                </span>
              </div>

              <div className="inventory-receipt-footer">
                <button
                  type="button"
                  className="inventory-receipt-cancel"
                  onClick={resetReceipt}
                  disabled={saving}
                >
                  Limpiar
                </button>

                <button
                  type="submit"
                  className="inventory-receipt-submit"
                  disabled={
                    saving ||
                    loading ||
                    catalogLoading ||
                    !!catalogError ||
                    !!error ||
                    validDraftRows.length === 0
                  }
                >
                  {saving ? "Registrando ingreso..." : "Confirmar recepción"}
                </button>
              </div>
            </div>

            {formError && (
              <div className="inventory-receipt-error" role="alert">
                {formError}
              </div>
            )}
          </form>
        </section>
      )}

      {canManageInventory && supplierModalOpen && (
        <div style={modalOverlayStyle}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-modal-title"
            style={{
              ...modalPanelStyle,
              maxWidth: "640px",
            }}
          >
            <div className="inventory-entry-modal-heading">
              <div>
                <span className="inventory-eyebrow">
                  REGISTRO DE PROVEEDORES
                </span>
                <h2 id="supplier-modal-title">Nuevo proveedor</h2>
                <p>
                  Registra los datos del proveedor para asociarlo a la factura.
                </p>
              </div>

              <button
                type="button"
                className="inventory-entry-modal-close"
                onClick={() => {
                  if (!supplierSaving) {
                    setSupplierModalOpen(false);
                    setSupplierError("");
                  }
                }}
                disabled={supplierSaving}
                aria-label="Cerrar ventana"
              >
                ×
              </button>
            </div>

            <form onSubmit={submitSupplier}>
              <div className="inventory-receipt-grid">
                <div className="inventory-receipt-field">
                  <label htmlFor="supplier-nit">NIT (obligatorio)</label>

                  <input
                    id="supplier-nit"
                    value={supplierForm.nit}
                    onChange={(event) =>
                      updateSupplierField("nit", event.target.value)
                    }
                    maxLength={30}
                    placeholder="Ej. 900123456-7"
                    required
                    autoFocus
                  />
                </div>

                <div className="inventory-receipt-field">
                  <label htmlFor="supplier-name">
                    Razón social (obligatoria)
                  </label>

                  <input
                    id="supplier-name"
                    value={supplierForm.razonSocial}
                    onChange={(event) =>
                      updateSupplierField("razonSocial", event.target.value)
                    }
                    maxLength={150}
                    placeholder="Nombre legal del proveedor"
                    required
                  />
                </div>

                <div className="inventory-receipt-field">
                  <label htmlFor="supplier-commercial">
                    Nombre comercial (opcional)
                  </label>

                  <input
                    id="supplier-commercial"
                    value={supplierForm.nombreComercial ?? ""}
                    onChange={(event) =>
                      updateSupplierField("nombreComercial", event.target.value)
                    }
                    maxLength={150}
                  />
                </div>

                <div className="inventory-receipt-field">
                  <label htmlFor="supplier-phone">Teléfono (opcional)</label>

                  <input
                    id="supplier-phone"
                    type="tel"
                    value={supplierForm.telefono ?? ""}
                    onChange={(event) =>
                      updateSupplierField("telefono", event.target.value)
                    }
                    maxLength={30}
                  />
                </div>

                <div className="inventory-receipt-field">
                  <label htmlFor="supplier-email">Correo (opcional)</label>

                  <input
                    id="supplier-email"
                    type="email"
                    value={supplierForm.correo ?? ""}
                    onChange={(event) =>
                      updateSupplierField("correo", event.target.value)
                    }
                  />
                </div>

                <div className="inventory-receipt-field">
                  <label htmlFor="supplier-contact">
                    Persona de contacto (opcional)
                  </label>

                  <input
                    id="supplier-contact"
                    value={supplierForm.contacto ?? ""}
                    onChange={(event) =>
                      updateSupplierField("contacto", event.target.value)
                    }
                    maxLength={100}
                  />
                </div>

                <div className="inventory-receipt-field inventory-receipt-full">
                  <label htmlFor="supplier-address">Dirección (opcional)</label>

                  <input
                    id="supplier-address"
                    value={supplierForm.direccion ?? ""}
                    onChange={(event) =>
                      updateSupplierField("direccion", event.target.value)
                    }
                    maxLength={200}
                  />
                </div>
              </div>

              {supplierError && (
                <div
                  className="inventory-receipt-error"
                  role="alert"
                  style={{ marginTop: 16 }}
                >
                  {supplierError}
                </div>
              )}

              <div
                className="inventory-receipt-footer"
                style={{ marginTop: 22 }}
              >
                <button
                  type="button"
                  className="inventory-receipt-cancel"
                  onClick={() => {
                    if (!supplierSaving) {
                      setSupplierModalOpen(false);
                    }
                  }}
                  disabled={supplierSaving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="inventory-receipt-submit"
                  disabled={supplierSaving}
                >
                  {supplierSaving
                    ? "Guardando proveedor..."
                    : "Guardar proveedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canManageInventory && productModalOpen && (
        <div style={modalOverlayStyle}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
            style={modalPanelStyle}
          >
            <div className="inventory-entry-modal-heading">
              <div>
                <span className="inventory-eyebrow">
                  CATÁLOGO DE INVENTARIO
                </span>

                <h2 id="product-modal-title">Nuevo producto</h2>

                <p>
                  El código interno se genera automáticamente. El lote y sus
                  condiciones se registran en la tabla de recepción.
                </p>
              </div>

              <button
                type="button"
                className="inventory-entry-modal-close"
                onClick={() => {
                  if (!productSaving) {
                    setProductModalOpen(false);
                    setNewProductError("");
                    setProductTargetRowId(null);
                  }
                }}
                disabled={productSaving}
                aria-label="Cerrar ventana"
              >
                ×
              </button>
            </div>

            <form onSubmit={submitNewProduct}>
              <div className="inventory-receipt-grid">
                <div className="inventory-receipt-field">
                  <label htmlFor="new-product-type">Tipo de producto</label>

                  <select
                    id="new-product-type"
                    value={newProductForm.tipo}
                    onChange={(event) => {
                      const tipo = event.target.value as InventoryProductType;

                      setNewProductForm((previous) => ({
                        ...previous,
                        tipo,
                        claseRiesgo:
                          tipo === "DISPOSITIVO_MEDICO"
                            ? previous.claseRiesgo
                            : "",
                      }));

                      setNewProductError("");
                    }}
                    required
                  >
                    <option value="MEDICAMENTO">Medicamento</option>
                    <option value="DISPOSITIVO_MEDICO">
                      Dispositivo médico
                    </option>
                    <option value="INSUMO">Insumo</option>
                  </select>
                </div>

                {newProductForm.tipo !== "MEDICAMENTO" && (
                  <div className="inventory-receipt-field">
                    <label htmlFor="new-product-description">
                      Descripción del producto
                    </label>

                    <input
                      id="new-product-description"
                      value={newProductForm.descripcion}
                      onChange={(event) =>
                        updateNewProductField("descripcion", event.target.value)
                      }
                      required
                      placeholder="Nombre o descripción del producto"
                    />
                  </div>
                )}

                {newProductForm.tipo === "MEDICAMENTO" && (
                  <>
                    <div className="inventory-receipt-field">
                      <label htmlFor="new-med-name">
                        Nombre del medicamento
                      </label>

                      <input
                        id="new-med-name"
                        value={newProductForm.nombre}
                        onChange={(event) =>
                          updateNewProductField("nombre", event.target.value)
                        }
                        required
                        placeholder="Ej. Omeprazol"
                      />
                    </div>

                    <div className="inventory-receipt-field">
                      <label htmlFor="new-med-concentration">
                        Concentración
                      </label>

                      <input
                        id="new-med-concentration"
                        value={newProductForm.concentracion}
                        onChange={(event) =>
                          updateNewProductField(
                            "concentracion",
                            event.target.value,
                          )
                        }
                        required
                        placeholder="Ej. 20 mg"
                      />
                    </div>

                    <div className="inventory-receipt-field">
                      <label htmlFor="new-med-form">Forma farmacéutica</label>

                      <input
                        id="new-med-form"
                        value={newProductForm.formaFarmaceutica}
                        onChange={(event) =>
                          updateNewProductField(
                            "formaFarmaceutica",
                            event.target.value,
                          )
                        }
                        required
                        placeholder="Ej. Cápsula"
                      />
                    </div>
                  </>
                )}

                <div className="inventory-receipt-field">
                  <label htmlFor="new-product-brand">Marca (opcional)</label>

                  <input
                    id="new-product-brand"
                    value={newProductForm.marca}
                    onChange={(event) =>
                      updateNewProductField("marca", event.target.value)
                    }
                  />
                </div>

                <div className="inventory-receipt-field">
                  <label htmlFor="new-product-lab">
                    Laboratorio / fabricante (opcional)
                  </label>

                  <input
                    id="new-product-lab"
                    value={newProductForm.laboratorio}
                    onChange={(event) =>
                      updateNewProductField("laboratorio", event.target.value)
                    }
                  />
                </div>

                <div className="inventory-receipt-field">
                  <label htmlFor="new-product-invima">
                    Número de registro INVIMA (opcional)
                  </label>

                  <input
                    id="new-product-invima"
                    value={newProductForm.registroInvima}
                    onChange={(event) =>
                      updateNewProductField(
                        "registroInvima",
                        event.target.value,
                      )
                    }
                    placeholder="Número del registro sanitario"
                  />
                </div>

                <div className="inventory-receipt-field">
                  <label htmlFor="new-product-storage">
                    Condición de conservación
                  </label>

                  <select
                    id="new-product-storage"
                    value={newProductForm.condicionConservacion}
                    onChange={(event) =>
                      updateNewProductField(
                        "condicionConservacion",
                        event.target.value as InventoryConservationCondition,
                      )
                    }
                  >
                    <option value="AMBIENTE">Ambiente</option>
                    <option value="CADENA_FRIO">Cadena de frío</option>
                    <option value="OTRA">Otra</option>
                  </select>
                </div>

                {newProductForm.tipo === "DISPOSITIVO_MEDICO" && (
                  <div className="inventory-receipt-field">
                    <label htmlFor="new-product-risk">
                      Clase de riesgo del dispositivo médico
                    </label>

                    <select
                      id="new-product-risk"
                      value={newProductForm.claseRiesgo}
                      onChange={(event) =>
                        updateNewProductField("claseRiesgo", event.target.value)
                      }
                      required
                    >
                      <option value="">Seleccionar clase de riesgo</option>
                      <option value="I">Clase I</option>
                      <option value="IIA">Clase IIa</option>
                      <option value="IIB">Clase IIb</option>
                      <option value="III">Clase III</option>
                    </select>
                  </div>
                )}
              </div>

              <p className="inventory-receipt-hint">
                Después de guardar, el producto quedará seleccionado en la fila
                donde lo estás registrando. La clase de riesgo se solicita
                únicamente para dispositivos médicos.
              </p>

              {newProductError && (
                <div
                  className="inventory-receipt-error"
                  role="alert"
                  style={{ marginTop: 16 }}
                >
                  {newProductError}
                </div>
              )}

              <div
                className="inventory-receipt-footer"
                style={{ marginTop: 22 }}
              >
                <button
                  type="button"
                  className="inventory-receipt-cancel"
                  onClick={() => {
                    if (!productSaving) {
                      setProductModalOpen(false);
                      setProductTargetRowId(null);
                    }
                  }}
                  disabled={productSaving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="inventory-receipt-submit"
                  disabled={productSaving}
                >
                  {productSaving ? "Guardando producto..." : "Guardar producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default Inventory;
