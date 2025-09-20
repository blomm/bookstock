-- DropForeignKey
ALTER TABLE "public"."inventory" DROP CONSTRAINT "inventory_title_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."inventory" DROP CONSTRAINT "inventory_warehouse_id_fkey";

-- AddForeignKey
ALTER TABLE "public"."inventory" ADD CONSTRAINT "inventory_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory" ADD CONSTRAINT "inventory_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
