/*
  Warnings:

  - You are about to alter the column `codigoInterno` on the `productos_inventario` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - Added the required column `descripcion` to the `productos_inventario` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipo` to the `productos_inventario` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `productos_inventario` DROP FOREIGN KEY `productos_inventario_medicamentoId_fkey`;

-- DropIndex
DROP INDEX `productos_inventario_medicamentoId_fkey` ON `productos_inventario`;

-- AlterTable
ALTER TABLE `productos_inventario` ADD COLUMN `descripcion` VARCHAR(191) NOT NULL,
    ADD COLUMN `tipo` ENUM('MEDICAMENTO', 'INSUMO') NOT NULL,
    MODIFY `medicamentoId` INTEGER NULL,
    MODIFY `codigoInterno` INTEGER NULL,
    MODIFY `laboratorio` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `productos_inventario` ADD CONSTRAINT `productos_inventario_medicamentoId_fkey` FOREIGN KEY (`medicamentoId`) REFERENCES `medicamentos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
