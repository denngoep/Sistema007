-- CreateTable
CREATE TABLE `medicamentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `concentracion` VARCHAR(191) NOT NULL,
    `formaFarmaceutica` VARCHAR(191) NOT NULL,
    `viaAdministracion` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `medicamentos_nombre_concentracion_formaFarmaceutica_key`(`nombre`, `concentracion`, `formaFarmaceutica`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `productos_inventario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `medicamentoId` INTEGER NOT NULL,
    `codigoInterno` VARCHAR(191) NOT NULL,
    `marca` VARCHAR(191) NULL,
    `laboratorio` VARCHAR(191) NOT NULL,
    `registroInvima` VARCHAR(191) NULL,
    `estado` ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `productos_inventario_codigoInterno_key`(`codigoInterno`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lotes_inventario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productoInventarioId` INTEGER NOT NULL,
    `numeroLote` VARCHAR(191) NOT NULL,
    `fechaVencimiento` DATETIME(3) NOT NULL,
    `cantidad` INTEGER NOT NULL DEFAULT 0,
    `estado` ENUM('DISPONIBLE', 'AGOTADO', 'VENCIDO', 'BLOQUEADO') NOT NULL DEFAULT 'DISPONIBLE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lotes_inventario_productoInventarioId_numeroLote_key`(`productoInventarioId`, `numeroLote`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `productos_inventario` ADD CONSTRAINT `productos_inventario_medicamentoId_fkey` FOREIGN KEY (`medicamentoId`) REFERENCES `medicamentos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lotes_inventario` ADD CONSTRAINT `lotes_inventario_productoInventarioId_fkey` FOREIGN KEY (`productoInventarioId`) REFERENCES `productos_inventario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
