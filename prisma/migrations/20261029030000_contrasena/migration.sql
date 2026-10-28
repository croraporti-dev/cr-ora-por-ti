-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT;

-- DropTable
DROP TABLE "LoginToken";

-- CreateTable
CREATE TABLE "EnlaceAcceso" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnlaceAcceso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnlaceAcceso_tokenHash_key" ON "EnlaceAcceso"("tokenHash");

-- CreateIndex
CREATE INDEX "EnlaceAcceso_userId_idx" ON "EnlaceAcceso"("userId");

-- AddForeignKey
ALTER TABLE "EnlaceAcceso" ADD CONSTRAINT "EnlaceAcceso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

