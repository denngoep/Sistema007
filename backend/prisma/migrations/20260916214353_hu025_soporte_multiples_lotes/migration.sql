/*
  HU-025 - Soporte para múltiples lotes en una misma dispensación.
*/

-- Restaurar la relación con la dispensación en caso de que
-- la ejecución anterior la haya eliminado.
ALTER TABLE `detalles_dispensacion`
ADD CONSTRAINT `detalles_dispensacion_dispensacionId_fkey`
FOREIGN KEY (`dispensacionId`)
REFERENCES `dispensaciones`(`id`)
ON DELETE CASCADE
ON UPDATE CASCADE;