-- AlterTable
ALTER TABLE "public"."stock_movements" ADD COLUMN     "batch_number" VARCHAR(100),
ADD COLUMN     "expiry_date" TIMESTAMP(3),
ADD COLUMN     "lot_id" VARCHAR(50),
ADD COLUMN     "manufacturing_date" TIMESTAMP(3),
ADD COLUMN     "supplier_batch_ref" VARCHAR(100);

-- CreateIndex
CREATE INDEX "stock_movements_batch_number_idx" ON "public"."stock_movements"("batch_number");

-- CreateIndex
CREATE INDEX "stock_movements_lot_id_idx" ON "public"."stock_movements"("lot_id");

-- CreateIndex
CREATE INDEX "stock_movements_expiry_date_idx" ON "public"."stock_movements"("expiry_date");

-- CreateIndex
CREATE INDEX "stock_movements_manufacturing_date_idx" ON "public"."stock_movements"("manufacturing_date");
