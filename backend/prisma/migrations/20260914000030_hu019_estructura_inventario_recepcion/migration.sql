/*
  Warnings:

  - A unique constraint covering the columns `[codigoBarras]` on the table `productos_inventario` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `productos_inventario` ADD COLUMN `codigoBarras` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `sedes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `direccion` VARCHAR(191) NULL,
    `ciudad` VARCHAR(191) NULL,
    `telefono` VARCHAR(191) NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sedes_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bodegas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sedeId` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `permiteDispensacion` BOOLEAN NOT NULL DEFAULT false,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `creadoPorId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bodegas_sedeId_idx`(`sedeId`),
    UNIQUE INDEX `bodegas_sedeId_nombre_key`(`sedeId`, `nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proveedores` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nit` VARCHAR(191) NOT NULL,
    `razonSocial` VARCHAR(191) NOT NULL,
    `nombreComercial` VARCHAR(191) NULL,
    `telefono` VARCHAR(191) NULL,
    `correo` VARCHAR(191) NULL,
    `direccion` VARCHAR(191) NULL,
    `contacto` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `proveedores_nit_key`(`nit`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actas_recepcion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numeroActa` VARCHAR(191) NOT NULL,
    `sedeId` INTEGER NOT NULL,
    `proveedorId` INTEGER NOT NULL,
    `elaboradoPorId` INTEGER NOT NULL,
    `revisadoPorId` INTEGER NULL,
    `numeroFactura` VARCHAR(191) NULL,
    `numeroOrdenCompra` VARCHAR(191) NULL,
    `numeroRemision` VARCHAR(191) NULL,
    `fechaFactura` DATETIME(3) NULL,
    `fechaRecepcion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `estado` ENUM('BORRADOR', 'PENDIENTE_REVISION', 'APROBADA', 'RECHAZADA', 'ANULADA') NOT NULL DEFAULT 'BORRADOR',
    `observaciones` VARCHAR(191) NULL,
    `fechaRevision` DATETIME(3) NULL,
    `motivoRechazo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `actas_recepcion_numeroActa_key`(`numeroActa`),
    INDEX `actas_recepcion_sedeId_idx`(`sedeId`),
    INDEX `actas_recepcion_proveedorId_idx`(`proveedorId`),
    INDEX `actas_recepcion_elaboradoPorId_idx`(`elaboradoPorId`),
    INDEX `actas_recepcion_revisadoPorId_idx`(`revisadoPorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `detalles_acta_recepcion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actaRecepcionId` INTEGER NOT NULL,
    `productoId` INTEGER NOT NULL,
    `numeroLote` VARCHAR(191) NOT NULL,
    `fechaVencimiento` DATETIME(3) NOT NULL,
    `cantidadRecibida` INTEGER NOT NULL,
    `registroInvima` VARCHAR(191) NULL,
    `observaciones` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `detalles_acta_recepcion_actaRecepcionId_idx`(`actaRecepcionId`),
    INDEX `detalles_acta_recepcion_productoId_idx`(`productoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ingresos_inventario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numeroIngreso` VARCHAR(191) NOT NULL,
    `actaRecepcionId` INTEGER NOT NULL,
    `bodegaDestinoId` INTEGER NOT NULL,
    `confirmadoPorId` INTEGER NOT NULL,
    `fechaIngreso` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `estado` ENUM('BORRADOR', 'CONFIRMADO', 'ANULADO') NOT NULL DEFAULT 'BORRADOR',
    `observaciones` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ingresos_inventario_numeroIngreso_key`(`numeroIngreso`),
    UNIQUE INDEX `ingresos_inventario_actaRecepcionId_key`(`actaRecepcionId`),
    INDEX `ingresos_inventario_bodegaDestinoId_idx`(`bodegaDestinoId`),
    INDEX `ingresos_inventario_confirmadoPorId_idx`(`confirmadoPorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `detalles_ingreso_inventario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ingresoInventarioId` INTEGER NOT NULL,
    `detalleActaRecepcionId` INTEGER NOT NULL,
    `loteId` INTEGER NOT NULL,
    `cantidadIngresada` INTEGER NOT NULL,
    `costoUnitario` DECIMAL(12, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `detalles_ingreso_inventario_detalleActaRecepcionId_key`(`detalleActaRecepcionId`),
    INDEX `detalles_ingreso_inventario_ingresoInventarioId_idx`(`ingresoInventarioId`),
    INDEX `detalles_ingreso_inventario_loteId_idx`(`loteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `existencias_inventario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `loteId` INTEGER NOT NULL,
    `bodegaId` INTEGER NOT NULL,
    `cantidad` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `existencias_inventario_bodegaId_idx`(`bodegaId`),
    UNIQUE INDEX `existencias_inventario_loteId_bodegaId_key`(`loteId`, `bodegaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movimientos_inventario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `loteId` INTEGER NOT NULL,
    `tipo` ENUM('INGRESO', 'TRASLADO', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA') NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `bodegaOrigenId` INTEGER NULL,
    `bodegaDestinoId` INTEGER NULL,
    `usuarioId` INTEGER NOT NULL,
    `ingresoInventarioId` INTEGER NULL,
    `motivo` VARCHAR(191) NULL,
    `referencia` VARCHAR(191) NULL,
    `fechaMovimiento` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `movimientos_inventario_loteId_idx`(`loteId`),
    INDEX `movimientos_inventario_bodegaOrigenId_idx`(`bodegaOrigenId`),
    INDEX `movimientos_inventario_bodegaDestinoId_idx`(`bodegaDestinoId`),
    INDEX `movimientos_inventario_usuarioId_idx`(`usuarioId`),
    INDEX `movimientos_inventario_ingresoInventarioId_idx`(`ingresoInventarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `productos_inventario_codigoBarras_key` ON `productos_inventario`(`codigoBarras`);

-- AddForeignKey
ALTER TABLE `bodegas` ADD CONSTRAINT `bodegas_sedeId_fkey` FOREIGN KEY (`sedeId`) REFERENCES `sedes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bodegas` ADD CONSTRAINT `bodegas_creadoPorId_fkey` FOREIGN KEY (`creadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actas_recepcion` ADD CONSTRAINT `actas_recepcion_sedeId_fkey` FOREIGN KEY (`sedeId`) REFERENCES `sedes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actas_recepcion` ADD CONSTRAINT `actas_recepcion_proveedorId_fkey` FOREIGN KEY (`proveedorId`) REFERENCES `proveedores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actas_recepcion` ADD CONSTRAINT `actas_recepcion_elaboradoPorId_fkey` FOREIGN KEY (`elaboradoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actas_recepcion` ADD CONSTRAINT `actas_recepcion_revisadoPorId_fkey` FOREIGN KEY (`revisadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detalles_acta_recepcion` ADD CONSTRAINT `detalles_acta_recepcion_actaRecepcionId_fkey` FOREIGN KEY (`actaRecepcionId`) REFERENCES `actas_recepcion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detalles_acta_recepcion` ADD CONSTRAINT `detalles_acta_recepcion_productoId_fkey` FOREIGN KEY (`productoId`) REFERENCES `productos_inventario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingresos_inventario` ADD CONSTRAINT `ingresos_inventario_actaRecepcionId_fkey` FOREIGN KEY (`actaRecepcionId`) REFERENCES `actas_recepcion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingresos_inventario` ADD CONSTRAINT `ingresos_inventario_bodegaDestinoId_fkey` FOREIGN KEY (`bodegaDestinoId`) REFERENCES `bodegas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingresos_inventario` ADD CONSTRAINT `ingresos_inventario_confirmadoPorId_fkey` FOREIGN KEY (`confirmadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detalles_ingreso_inventario` ADD CONSTRAINT `detalles_ingreso_inventario_ingresoInventarioId_fkey` FOREIGN KEY (`ingresoInventarioId`) REFERENCES `ingresos_inventario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detalles_ingreso_inventario` ADD CONSTRAINT `detalles_ingreso_inventario_detalleActaRecepcionId_fkey` FOREIGN KEY (`detalleActaRecepcionId`) REFERENCES `detalles_acta_recepcion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detalles_ingreso_inventario` ADD CONSTRAINT `detalles_ingreso_inventario_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `lotes_inventario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `existencias_inventario` ADD CONSTRAINT `existencias_inventario_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `lotes_inventario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `existencias_inventario` ADD CONSTRAINT `existencias_inventario_bodegaId_fkey` FOREIGN KEY (`bodegaId`) REFERENCES `bodegas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientos_inventario` ADD CONSTRAINT `movimientos_inventario_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `lotes_inventario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientos_inventario` ADD CONSTRAINT `movimientos_inventario_bodegaOrigenId_fkey` FOREIGN KEY (`bodegaOrigenId`) REFERENCES `bodegas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientos_inventario` ADD CONSTRAINT `movimientos_inventario_bodegaDestinoId_fkey` FOREIGN KEY (`bodegaDestinoId`) REFERENCES `bodegas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientos_inventario` ADD CONSTRAINT `movimientos_inventario_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientos_inventario` ADD CONSTRAINT `movimientos_inventario_ingresoInventarioId_fkey` FOREIGN KEY (`ingresoInventarioId`) REFERENCES `ingresos_inventario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
