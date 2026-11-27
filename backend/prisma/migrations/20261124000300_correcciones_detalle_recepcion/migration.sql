-- Restores the additive table represented in schema.prisma. It is a
-- prerequisite for the documentary relation introduced in the next migration.
CREATE TABLE IF NOT EXISTS `correcciones_detalle_recepcion` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `detalleActaRecepcionId` INTEGER NOT NULL,
  `responsableId` INTEGER NOT NULL,
  `numeroLoteAnterior` VARCHAR(191) NOT NULL,
  `numeroLoteNuevo` VARCHAR(191) NOT NULL,
  `fechaVencimientoAnterior` DATETIME(3) NOT NULL,
  `fechaVencimientoNueva` DATETIME(3) NOT NULL,
  `cantidadRecibidaAnterior` INTEGER NOT NULL,
  `cantidadRecibidaNueva` INTEGER NOT NULL,
  `motivo` VARCHAR(191) NOT NULL,
  `referencia` VARCHAR(191) NOT NULL,
  `fechaCorreccion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `idx_corr_rec_det`(`detalleActaRecepcionId`),
  INDEX `idx_corr_rec_resp`(`responsableId`),
  CONSTRAINT `fk_corr_rec_det` FOREIGN KEY (`detalleActaRecepcionId`) REFERENCES `detalles_acta_recepcion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_corr_rec_resp` FOREIGN KEY (`responsableId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
