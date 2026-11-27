-- Inventario documental: migración exclusivamente aditiva.
-- No modifica existencias, movimientos ni actas históricas.
-- IF NOT EXISTS conserva la tabla creada antes del fallo P3018. Las otras
-- tablas no llegaron a crearse porque MySQL rechazó el índice largo.
CREATE TABLE IF NOT EXISTS `documentos_inventario` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `claveAlmacenamiento` VARCHAR(80) NOT NULL,
  `sha256` CHAR(64) NOT NULL,
  `mime` VARCHAR(64) NOT NULL,
  `tamano` INTEGER NOT NULL,
  `creadoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `creadoPorId` INTEGER NOT NULL,
  `versionPlantilla` VARCHAR(32) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `documentos_inventario_claveAlmacenamiento_key` (`claveAlmacenamiento`),
  INDEX `documentos_inventario_creadoPorId_idx` (`creadoPorId`),
  CONSTRAINT `documentos_inventario_creadoPorId_fkey`
    FOREIGN KEY (`creadoPorId`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `documentos_movimiento_inventario` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `movimientoInventarioId` INTEGER NOT NULL,
  `documentoInventarioId` INTEGER NOT NULL,
  `proposito` VARCHAR(32) NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `datosComprobante` JSON NULL,
  `motivoCorreccion` TEXT NULL,
  `registradoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `registradoPorId` INTEGER NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_dmi_mov_prop_ver` (`movimientoInventarioId`, `proposito`, `version`),
  INDEX `idx_dmi_mov_prop` (`movimientoInventarioId`, `proposito`),
  INDEX `idx_dmi_documento` (`documentoInventarioId`),
  INDEX `idx_dmi_registrado` (`registradoPorId`),
  CONSTRAINT `fk_dmi_movimiento`
    FOREIGN KEY (`movimientoInventarioId`) REFERENCES `movimientos_inventario` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_dmi_documento`
    FOREIGN KEY (`documentoInventarioId`) REFERENCES `documentos_inventario` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_dmi_registrado`
    FOREIGN KEY (`registradoPorId`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `documentos_acta_recepcion` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `actaRecepcionId` INTEGER NOT NULL,
  `documentoInventarioId` INTEGER NOT NULL,
  `proposito` VARCHAR(32) NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `registradoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `registradoPorId` INTEGER NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_dar_act_prop_ver` (`actaRecepcionId`, `proposito`, `version`),
  INDEX `idx_dar_act_prop` (`actaRecepcionId`, `proposito`),
  INDEX `idx_dar_documento` (`documentoInventarioId`),
  INDEX `idx_dar_registrado` (`registradoPorId`),
  CONSTRAINT `fk_dar_acta`
    FOREIGN KEY (`actaRecepcionId`) REFERENCES `actas_recepcion` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_dar_documento`
    FOREIGN KEY (`documentoInventarioId`) REFERENCES `documentos_inventario` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_dar_registrado`
    FOREIGN KEY (`registradoPorId`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
