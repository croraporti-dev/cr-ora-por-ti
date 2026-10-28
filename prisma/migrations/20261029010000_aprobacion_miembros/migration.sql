-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aprobadoAt" TIMESTAMP(3);


-- Quienes ya estaban en el grupo quedan aprobados.
UPDATE "User" SET "aprobadoAt" = "createdAt" WHERE "aprobadoAt" IS NULL;
