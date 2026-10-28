-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('JOVEN', 'ORANTE', 'LIDER');

-- CreateEnum
CREATE TYPE "TipoEvaluacion" AS ENUM ('PRUEBA', 'EXAMEN', 'TRABAJO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoEvaluacion" AS ENUM ('PENDIENTE', 'REALIZADA');

-- CreateEnum
CREATE TYPE "Animo" AS ENUM ('BIEN', 'MAS_O_MENOS', 'NECESITA_ORACION');

-- CreateEnum
CREATE TYPE "Anticipacion" AS ENUM ('UNA_HORA', 'TRES_HORAS', 'NOCHE_ANTERIOR_20H');

-- CreateEnum
CREATE TYPE "Seguir" AS ENUM ('TODOS', 'LISTA');

-- CreateEnum
CREATE TYPE "TipoAviso" AS ENUM ('ANTES', 'DESPUES');

-- CreateEnum
CREATE TYPE "Canal" AS ENUM ('EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "EstadoEnvio" AS ENUM ('ENVIANDO', 'OK', 'FALLO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'ORANTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aceptoAvisoAt" TIMESTAMP(3),
    "esMenor" BOOLEAN NOT NULL DEFAULT false,
    "apoderadoAt" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" "TipoEvaluacion" NOT NULL,
    "ramo" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoEvaluacion" NOT NULL DEFAULT 'PENDIENTE',
    "resultadoAnimo" "Animo",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPrefs" (
    "userId" TEXT NOT NULL,
    "emailAntes" BOOLEAN NOT NULL DEFAULT false,
    "emailDespues" BOOLEAN NOT NULL DEFAULT false,
    "pushAntes" BOOLEAN NOT NULL DEFAULT true,
    "pushDespues" BOOLEAN NOT NULL DEFAULT true,
    "tambienCorreo" BOOLEAN NOT NULL DEFAULT false,
    "anticipacion" "Anticipacion" NOT NULL DEFAULT 'UNA_HORA',
    "seguir" "Seguir" NOT NULL DEFAULT 'TODOS',
    "pushNecesitaReactivar" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NotificationPrefs_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "fallosSeguidos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrayerLog" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrayerLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "tipo" "TipoAviso" NOT NULL,
    "canal" "Canal" NOT NULL,
    "estado" "EstadoEnvio" NOT NULL DEFAULT 'ENVIANDO',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "LoginToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "linkHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "registro" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "_JovenesSeguidos" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_JovenesSeguidos_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Evaluation_fechaHora_idx" ON "Evaluation"("fechaHora");

-- CreateIndex
CREATE INDEX "Evaluation_userId_idx" ON "Evaluation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PrayerLog_evaluationId_userId_key" ON "PrayerLog"("evaluationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_userId_evaluationId_tipo_canal_key" ON "NotificationLog"("userId", "evaluationId", "tipo", "canal");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LoginToken_linkHash_key" ON "LoginToken"("linkHash");

-- CreateIndex
CREATE INDEX "LoginToken_email_idx" ON "LoginToken"("email");

-- CreateIndex
CREATE INDEX "_JovenesSeguidos_B_index" ON "_JovenesSeguidos"("B");

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPrefs" ADD CONSTRAINT "NotificationPrefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrayerLog" ADD CONSTRAINT "PrayerLog_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrayerLog" ADD CONSTRAINT "PrayerLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JovenesSeguidos" ADD CONSTRAINT "_JovenesSeguidos_A_fkey" FOREIGN KEY ("A") REFERENCES "NotificationPrefs"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JovenesSeguidos" ADD CONSTRAINT "_JovenesSeguidos_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
