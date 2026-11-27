-- AlterTable
ALTER TABLE `dispensaciones` ADD COLUMN `claveIdempotencia` VARCHAR(64) NULL,
    ADD COLUMN `datosComprobante` JSON NULL,
    ADD COLUMN `hashSolicitud` CHAR(64) NULL,
    ADD COLUMN `versionDocumental` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `documentos_dispensacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dispensacionId` INTEGER NOT NULL,
    `proposito` VARCHAR(32) NOT NULL,
    `claveAlmacenamiento` VARCHAR(80) NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `mime` VARCHAR(64) NOT NULL,
    `tamano` INTEGER NOT NULL,
    `creadoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `creadoPorId` INTEGER NOT NULL,
    `versionPlantilla` VARCHAR(32) NULL,

    UNIQUE INDEX `documentos_dispensacion_claveAlmacenamiento_key`(`claveAlmacenamiento`),
    INDEX `documentos_dispensacion_dispensacionId_proposito_idx`(`dispensacionId`, `proposito`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `soportes_dispensacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dispensacionId` INTEGER NOT NULL,
    `version` INTEGER NOT NULL,
    `modalidad` ENUM('DIGITAL', 'MANUAL') NOT NULL,
    `tipoReceptor` VARCHAR(32) NOT NULL,
    `nombreReceptor` VARCHAR(191) NOT NULL,
    `tipoDocumentoReceptor` VARCHAR(32) NOT NULL,
    `numeroDocumentoReceptor` VARCHAR(191) NOT NULL,
    `relacionReceptor` VARCHAR(191) NULL,
    `constanciaAutorizacion` TEXT NULL,
    `fechaFirma` DATETIME(3) NOT NULL,
    `registradoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `registradoPorId` INTEGER NOT NULL,
    `motivoCorreccion` TEXT NULL,
    `documentoBaseId` INTEGER NOT NULL,
    `documentoFirmadoId` INTEGER NOT NULL,
    `imagenFirmaId` INTEGER NULL,

    UNIQUE INDEX `soportes_dispensacion_documentoFirmadoId_key`(`documentoFirmadoId`),
    UNIQUE INDEX `soportes_dispensacion_imagenFirmaId_key`(`imagenFirmaId`),
    UNIQUE INDEX `soportes_dispensacion_dispensacionId_version_key`(`dispensacionId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `dispensaciones_claveIdempotencia_key` ON `dispensaciones`(`claveIdempotencia`);

-- AddForeignKey
ALTER TABLE `documentos_dispensacion` ADD CONSTRAINT `documentos_dispensacion_dispensacionId_fkey` FOREIGN KEY (`dispensacionId`) REFERENCES `dispensaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos_dispensacion` ADD CONSTRAINT `documentos_dispensacion_creadoPorId_fkey` FOREIGN KEY (`creadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `soportes_dispensacion` ADD CONSTRAINT `soportes_dispensacion_dispensacionId_fkey` FOREIGN KEY (`dispensacionId`) REFERENCES `dispensaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `soportes_dispensacion` ADD CONSTRAINT `soportes_dispensacion_registradoPorId_fkey` FOREIGN KEY (`registradoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `soportes_dispensacion` ADD CONSTRAINT `soportes_dispensacion_documentoBaseId_fkey` FOREIGN KEY (`documentoBaseId`) REFERENCES `documentos_dispensacion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `soportes_dispensacion` ADD CONSTRAINT `soportes_dispensacion_documentoFirmadoId_fkey` FOREIGN KEY (`documentoFirmadoId`) REFERENCES `documentos_dispensacion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `soportes_dispensacion` ADD CONSTRAINT `soportes_dispensacion_imagenFirmaId_fkey` FOREIGN KEY (`imagenFirmaId`) REFERENCES `documentos_dispensacion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
