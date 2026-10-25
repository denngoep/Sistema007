-- CreateTable
CREATE TABLE `recuperaciones_password` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `codigoHash` VARCHAR(191) NOT NULL,
    `fechaExpiracion` DATETIME(3) NOT NULL,
    `intentosFallidos` INTEGER NOT NULL DEFAULT 0,
    `utilizado` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `recuperaciones_password_usuarioId_createdAt_idx`(`usuarioId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `recuperaciones_password` ADD CONSTRAINT `recuperaciones_password_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
