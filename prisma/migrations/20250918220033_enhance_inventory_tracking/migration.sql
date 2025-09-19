-- AlterTable
ALTER TABLE "public"."inventory" ADD COLUMN     "average_cost" DECIMAL(8,2),
ADD COLUMN     "bin_location" VARCHAR(100),
ADD COLUMN     "last_cost_update" TIMESTAMP(3),
ADD COLUMN     "max_stock_level" INTEGER,
ADD COLUMN     "min_stock_level" INTEGER,
ADD COLUMN     "reorder_point" INTEGER,
ADD COLUMN     "total_value" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "inventory_average_cost_idx" ON "public"."inventory"("average_cost");

-- CreateIndex
CREATE INDEX "inventory_min_stock_level_idx" ON "public"."inventory"("min_stock_level");

-- CreateIndex
CREATE INDEX "inventory_reorder_point_idx" ON "public"."inventory"("reorder_point");
