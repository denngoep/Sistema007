// Stable JSON captured in the same transaction as the delivered lots.

export function receiptSnapshot(d: {
  numeroComprobante: string | null;
  fechaComprobante: Date | null;

  numeroDispensacion: string;
  fechaDispensacion: Date;

  paciente: {
    tipoDocumento: string;
    numeroDocumento: string;
    nombres: string;
    apellidos: string;
  };

  bodega: {
    nombre: string;
    sede: {
      nombre: string;
    };
  };

  dispensadoPor: {
    id: number;
    nombre: string;
    rol: string;
  };

  detalles: Array<{
    cantidadEntregada: number;

    lote: {
      numeroLote: string;
      fechaVencimiento: Date;

      productoInventario: {
        codigoInterno: number | null;
        codigoBarras: string | null;
      };
    };

    detalleFormulacion: {
      medicamento: string;
      concentracion: string | null;
      formaFarmaceutica: string | null;

      formulacion: {
        id: number;
        atencionClinica: {
          numeroIngreso: string;
        };
      };
    };
  }>;
}) {
  return {
    numeroComprobante: d.numeroComprobante,
    fechaComprobante: d.fechaComprobante?.toISOString() ?? null,

    numeroDispensacion: d.numeroDispensacion,
    fechaDispensacion: d.fechaDispensacion.toISOString(),

    paciente: {
      ...d.paciente,
    },

    sede: d.bodega.sede.nombre,
    bodega: d.bodega.nombre,

    dispensadoPor: {
      ...d.dispensadoPor,
    },

    medicamentos: d.detalles.map((x) => ({
      numeroIngreso:
        x.detalleFormulacion.formulacion.atencionClinica.numeroIngreso,

      formulacionId: x.detalleFormulacion.formulacion.id,

      codigoInterno: x.lote.productoInventario.codigoInterno,

      codigoBarras: x.lote.productoInventario.codigoBarras,

      medicamento: x.detalleFormulacion.medicamento,

      concentracion: x.detalleFormulacion.concentracion,

      formaFarmaceutica: x.detalleFormulacion.formaFarmaceutica,

      cantidadEntregada: x.cantidadEntregada,

      numeroLote: x.lote.numeroLote,

      fechaVencimiento: x.lote.fechaVencimiento.toISOString(),
    })),
  };
}
