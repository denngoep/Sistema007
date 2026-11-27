-- Additive relation between an immutable receipt-detail correction and its
-- private documentary evidence. Historical corrections remain valid without
-- an attached file.
CREATE TABLE `documentos_correccion_detalle_recepcion` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `correccionDetalleRecepcionId` INTEGER NOT NULL,
  `documentoInventarioId` INTEGER NOT NULL,
  `proposito` VARCHAR(32) NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `registradoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `registradoPorId` INTEGER NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_dcr_corr_prop_ver`(`correccionDetalleRecepcionId`, `proposito`, `version`),
  INDEX `idx_dcr_corr_prop`(`correccionDetalleRecepcionId`, `proposito`),
  INDEX `idx_dcr_doc`(`documentoInventarioId`),
  INDEX `idx_dcr_reg`(`registradoPorId`),
  CONSTRAINT `fk_dcr_corr` FOREIGN KEY (`correccionDetalleRecepcionId`) REFERENCES `correcciones_detalle_recepcion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_dcr_doc` FOREIGN KEY (`documentoInventarioId`) REFERENCES `documentos_inventario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_dcr_reg` FOREIGN KEY (`registradoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
