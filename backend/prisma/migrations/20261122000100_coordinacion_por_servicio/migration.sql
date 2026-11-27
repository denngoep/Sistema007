-- Prepared for review only. Do not apply until explicitly authorized.
CREATE TABLE `servicios` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(191) NOT NULL,
  `nombre` VARCHAR(191) NOT NULL,
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `servicios_codigo_key` (`codigo`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `usuarios`
  ADD COLUMN `servicioId` INTEGER NULL,
  ADD COLUMN `esCoordinador` BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX `usuarios_servicioId_idx` ON `usuarios`(`servicioId`);
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_servicioId_fkey`
  FOREIGN KEY (`servicioId`) REFERENCES `servicios`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `servicios` (`codigo`, `nombre`, `updatedAt`) VALUES
  ('ASISTENCIAL', 'Atención asistencial', CURRENT_TIMESTAMP(3)),
  ('FARMACIA', 'Servicio farmacéutico', CURRENT_TIMESTAMP(3)),
  ('ADMISIONES', 'Recepción y admisiones', CURRENT_TIMESTAMP(3));
-- Existing users remain unassigned and are not made coordinators.
