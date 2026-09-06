-- CreateTable
CREATE TABLE `pacientes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipoDocumento` VARCHAR(191) NOT NULL,
    `numeroDocumento` VARCHAR(191) NOT NULL,
    `nombres` VARCHAR(191) NOT NULL,
    `apellidos` VARCHAR(191) NOT NULL,
    `fechaNacimiento` DATETIME(3) NOT NULL,
    `telefono` VARCHAR(191) NULL,
    `correo` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pacientes_numeroDocumento_key`(`numeroDocumento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
