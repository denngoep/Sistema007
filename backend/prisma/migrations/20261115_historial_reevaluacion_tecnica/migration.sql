-- CreateTable
CREATE TABLE `reevaluaciones_tecnicas_recepcion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `detalleActaRecepcionId` INTEGER NOT NULL,
    `responsableId` INTEGER NOT NULL,
    `resultadoAnterior` ENUM('PENDIENTE', 'CONFORME', 'NO_CONFORME') NOT NULL,
    `resultadoNuevo` ENUM('PENDIENTE', 'CONFORME', 'NO_CONFORME') NOT NULL,
    `estadoInvimaAnterior` ENUM('PENDIENTE', 'VIGENTE', 'NO_VIGENTE', 'NO_APLICA') NOT NULL,
    `estadoInvimaNuevo` ENUM('PENDIENTE', 'VIGENTE', 'NO_VIGENTE', 'NO_APLICA') NOT NULL,
    `motivo` VARCHAR(191) NOT NULL,
    `referencia` VARCHAR(191) NOT NULL,
    `observaciones` VARCHAR(191) NULL,
    `fechaReevaluacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reevaluaciones_tecnicas_recepcion_detalleActaRecepcionId_idx`(`detalleActaRecepcionId`),
    INDEX `reevaluaciones_tecnicas_recepcion_responsableId_idx`(`responsableId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `reevaluaciones_tecnicas_recepcion` ADD CONSTRAINT `reevaluaciones_tecnicas_recepcion_detalleActaRecepcionId_fkey` FOREIGN KEY (`detalleActaRecepcionId`) REFERENCES `detalles_acta_recepcion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reevaluaciones_tecnicas_recepcion` ADD CONSTRAINT `reevaluaciones_tecnicas_recepcion_responsableId_fkey` FOREIGN KEY (`responsableId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

