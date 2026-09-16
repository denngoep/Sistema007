-- AlterTable
ALTER TABLE `movimientos_inventario` MODIFY `tipo` ENUM('INGRESO', 'TRASLADO', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'DISPENSACION') NOT NULL;

-- CreateTable
CREATE TABLE `dispensaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numeroDispensacion` VARCHAR(191) NOT NULL,
    `pacienteId` INTEGER NOT NULL,
    `bodegaId` INTEGER NOT NULL,
    `dispensadoPorId` INTEGER NOT NULL,
    `periodoAnio` INTEGER NOT NULL,
    `periodoMes` INTEGER NOT NULL,
    `fechaDispensacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `estado` ENUM('PENDIENTE', 'CONFIRMADA', 'ANULADA') NOT NULL DEFAULT 'PENDIENTE',
    `observaciones` VARCHAR(191) NULL,
    `numeroComprobante` VARCHAR(191) NULL,
    `fechaComprobante` DATETIME(3) NULL,
    `firmaPaciente` VARCHAR(191) NULL,
    `fechaFirma` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `dispensaciones_numeroDispensacion_key`(`numeroDispensacion`),
    UNIQUE INDEX `dispensaciones_numeroComprobante_key`(`numeroComprobante`),
    INDEX `dispensaciones_pacienteId_idx`(`pacienteId`),
    INDEX `dispensaciones_bodegaId_idx`(`bodegaId`),
    INDEX `dispensaciones_dispensadoPorId_idx`(`dispensadoPorId`),
    INDEX `dispensaciones_periodoAnio_periodoMes_idx`(`periodoAnio`, `periodoMes`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `detalles_dispensacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dispensacionId` INTEGER NOT NULL,
    `detalleFormulacionId` INTEGER NOT NULL,
    `loteId` INTEGER NOT NULL,
    `cantidadEntregada` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `detalles_dispensacion_detalleFormulacionId_idx`(`detalleFormulacionId`),
    INDEX `detalles_dispensacion_loteId_idx`(`loteId`),
    UNIQUE INDEX `detalles_dispensacion_dispensacionId_detalleFormulacionId_key`(`dispensacionId`, `detalleFormulacionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `dispensaciones` ADD CONSTRAINT `dispensaciones_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispensaciones` ADD CONSTRAINT `dispensaciones_bodegaId_fkey` FOREIGN KEY (`bodegaId`) REFERENCES `bodegas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispensaciones` ADD CONSTRAINT `dispensaciones_dispensadoPorId_fkey` FOREIGN KEY (`dispensadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detalles_dispensacion` ADD CONSTRAINT `detalles_dispensacion_dispensacionId_fkey` FOREIGN KEY (`dispensacionId`) REFERENCES `dispensaciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detalles_dispensacion` ADD CONSTRAINT `detalles_dispensacion_detalleFormulacionId_fkey` FOREIGN KEY (`detalleFormulacionId`) REFERENCES `detalles_formulacion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detalles_dispensacion` ADD CONSTRAINT `detalles_dispensacion_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `lotes_inventario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
