-- DropForeignKey
ALTER TABLE "public"."titles" DROP CONSTRAINT "titles_series_id_fkey";

-- AddForeignKey
ALTER TABLE "public"."titles" ADD CONSTRAINT "titles_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
