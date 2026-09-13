-- AlterTable
ALTER TABLE `formulaciones` ADD COLUMN `diagnosticoPacienteId` INTEGER NULL;

-- CreateTable
CREATE TABLE `diagnosticos_paciente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `historiaClinicaId` INTEGER NOT NULL,
    `atencionClinicaId` INTEGER NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `codigoCie10` VARCHAR(191) NULL,
    `tipo` ENUM('AGUDO', 'CRONICO', 'OTRO') NOT NULL,
    `requiereEsquema` BOOLEAN NOT NULL DEFAULT false,
    `fechaDiagnostico` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `observaciones` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `esquemas_tratamiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `diagnosticoPacienteId` INTEGER NOT NULL,
    `fechaInicio` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaFin` DATETIME(3) NULL,
    `estado` ENUM('ACTIVO', 'INACTIVO', 'SUSPENDIDO', 'FINALIZADO') NOT NULL DEFAULT 'ACTIVO',
    `observaciones` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `detalles_esquema_tratamiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `esquemaId` INTEGER NOT NULL,
    `medicamento` VARCHAR(191) NOT NULL,
    `concentracion` VARCHAR(191) NULL,
    `formaFarmaceutica` VARCHAR(191) NULL,
    `dosis` VARCHAR(191) NOT NULL,
    `frecuencia` VARCHAR(191) NOT NULL,
    `viaAdministracion` VARCHAR(191) NULL,
    `observaciones` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `diagnosticos_paciente` ADD CONSTRAINT `diagnosticos_paciente_historiaClinicaId_fkey` FOREIGN KEY (`historiaClinicaId`) REFERENCES `historias_clinicas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `diagnosticos_paciente` ADD CONSTRAINT `diagnosticos_paciente_atencionClinicaId_fkey` FOREIGN KEY (`atencionClinicaId`) REFERENCES `atenciones_clinicas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `esquemas_tratamiento` ADD CONSTRAINT `esquemas_tratamiento_diagnosticoPacienteId_fkey` FOREIGN KEY (`diagnosticoPacienteId`) REFERENCES `diagnosticos_paciente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detalles_esquema_tratamiento` ADD CONSTRAINT `detalles_esquema_tratamiento_esquemaId_fkey` FOREIGN KEY (`esquemaId`) REFERENCES `esquemas_tratamiento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `formulaciones` ADD CONSTRAINT `formulaciones_diagnosticoPacienteId_fkey` FOREIGN KEY (`diagnosticoPacienteId`) REFERENCES `diagnosticos_paciente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
