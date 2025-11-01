-- CreateEnum
CREATE TYPE "public"."WarehouseType" AS ENUM ('PHYSICAL', 'VIRTUAL', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "public"."WarehouseStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- AlterTable
ALTER TABLE "public"."warehouses" ADD COLUMN     "address_line1" VARCHAR(255),
ADD COLUMN     "address_line2" VARCHAR(255),
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "contact_email" VARCHAR(255),
ADD COLUMN     "contact_name" VARCHAR(100),
ADD COLUMN     "contact_phone" VARCHAR(20),
ADD COLUMN     "country" VARCHAR(2),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "postal_code" VARCHAR(20),
ADD COLUMN     "state_province" VARCHAR(100),
ADD COLUMN     "status" "public"."WarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "type" "public"."WarehouseType" NOT NULL DEFAULT 'PHYSICAL',
ALTER COLUMN "code" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "location" DROP NOT NULL,
ALTER COLUMN "fulfillsChannels" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "warehouses_status_idx" ON "public"."warehouses"("status");
