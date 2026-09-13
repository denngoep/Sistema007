-- CreateTable
CREATE TABLE `atenciones_clinicas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `historiaClinicaId` INTEGER NOT NULL,
    `profesionalId` INTEGER NOT NULL,
    `numeroIngreso` VARCHAR(191) NOT NULL,
    `fechaAtencion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `motivoConsulta` VARCHAR(191) NULL,
    `evolucion` VARCHAR(191) NULL,
    `diagnostico` VARCHAR(191) NULL,
    `observaciones` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `atenciones_clinicas_numeroIngreso_key`(`numeroIngreso`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `formulaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `atencionClinicaId` INTEGER NOT NULL,
    `fechaFormulacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `vigenciaMeses` INTEGER NOT NULL DEFAULT 1,
    `indicaciones` VARCHAR(191) NULL,
    `estado` ENUM('VIGENTE', 'VENCIDA', 'CANCELADA') NOT NULL DEFAULT 'VIGENTE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `detalles_formulacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `formulacionId` INTEGER NOT NULL,
    `medicamento` VARCHAR(191) NOT NULL,
    `concentracion` VARCHAR(191) NULL,
    `formaFarmaceutica` VARCHAR(191) NULL,
    `dosis` VARCHAR(191) NOT NULL,
    `frecuencia` VARCHAR(191) NOT NULL,
    `duracion` VARCHAR(191) NULL,
    `cantidad` INTEGER NOT NULL,
    `viaAdministracion` VARCHAR(191) NULL,
    `observaciones` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `atenciones_clinicas` ADD CONSTRAINT `atenciones_clinicas_historiaClinicaId_fkey` FOREIGN KEY (`historiaClinicaId`) REFERENCES `historias_clinicas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atenciones_clinicas` ADD CONSTRAINT `atenciones_clinicas_profesionalId_fkey` FOREIGN KEY (`profesionalId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `formulaciones` ADD CONSTRAINT `formulaciones_atencionClinicaId_fkey` FOREIGN KEY (`atencionClinicaId`) REFERENCES `atenciones_clinicas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detalles_formulacion` ADD CONSTRAINT `detalles_formulacion_formulacionId_fkey` FOREIGN KEY (`formulacionId`) REFERENCES `formulaciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
