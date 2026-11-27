-- Additive warehouse administration fields. Existing warehouses retain their
-- historical rows and may keep a null code until they are edited.
ALTER TABLE `bodegas` ADD COLUMN `codigo` VARCHAR(32) NULL;

CREATE UNIQUE INDEX `bodegas_codigo_key` ON `bodegas`(`codigo`);
