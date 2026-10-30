-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Anticipacion" ADD VALUE 'TREINTA_MIN';
ALTER TYPE "Anticipacion" ADD VALUE 'DOS_HORAS';

-- AlterEnum
ALTER TYPE "TipoAviso" ADD VALUE 'DIA_ANTERIOR';

-- AlterTable
ALTER TABLE "NotificationPrefs" ADD COLUMN     "diaAnterior" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "horaDiaAnterior" INTEGER NOT NULL DEFAULT 20;


-- Quien tenía "la noche anterior a las 20:00" pasa al nuevo recordatorio del día anterior,
-- y el aviso de antes de la prueba queda en 1 hora.
UPDATE "NotificationPrefs" SET "diaAnterior" = true, "horaDiaAnterior" = 20, "anticipacion" = 'UNA_HORA' WHERE "anticipacion" = 'NOCHE_ANTERIOR_20H';
