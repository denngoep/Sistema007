-- AlterTable
ALTER TABLE `detalles_acta_recepcion` ADD COLUMN `estadoVerificacionInvima` ENUM('PENDIENTE', 'VIGENTE', 'NO_VIGENTE', 'NO_APLICA') NOT NULL DEFAULT 'PENDIENTE',
    ADD COLUMN `humedadRegistrada` DOUBLE NULL,
    ADD COLUMN `resultadoVerificacion` ENUM('PENDIENTE', 'CONFORME', 'NO_CONFORME') NOT NULL DEFAULT 'PENDIENTE',
    ADD COLUMN `temperaturaRegistrada` DOUBLE NULL;

-- AlterTable
ALTER TABLE `productos_inventario` ADD COLUMN `claseRiesgo` VARCHAR(191) NULL,
    ADD COLUMN `condicionConservacion` ENUM('AMBIENTE', 'CADENA_FRIO', 'OTRA') NOT NULL DEFAULT 'AMBIENTE',
    ADD COLUMN `humedadMaxima` DOUBLE NULL,
    ADD COLUMN `temperaturaMaxima` DOUBLE NULL,
    ADD COLUMN `temperaturaMinima` DOUBLE NULL;

