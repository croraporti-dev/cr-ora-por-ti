-- DropForeignKey
ALTER TABLE "_JovenesSeguidos" DROP CONSTRAINT "_JovenesSeguidos_A_fkey";

-- DropForeignKey
ALTER TABLE "_JovenesSeguidos" DROP CONSTRAINT "_JovenesSeguidos_B_fkey";

-- AlterTable
ALTER TABLE "NotificationPrefs" DROP COLUMN "seguir";

-- DropTable
DROP TABLE "_JovenesSeguidos";

-- DropEnum
DROP TYPE "Seguir";

