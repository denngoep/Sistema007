-- AlterTable
ALTER TABLE `movimientos_inventario` ADD COLUMN `dispensacionId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `movimientos_inventario_dispensacionId_idx` ON `movimientos_inventario`(`dispensacionId`);

-- AddForeignKey
ALTER TABLE `movimientos_inventario` ADD CONSTRAINT `movimientos_inventario_dispensacionId_fkey` FOREIGN KEY (`dispensacionId`) REFERENCES `dispensaciones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
