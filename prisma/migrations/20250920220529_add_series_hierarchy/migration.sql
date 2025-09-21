/*
  Warnings:

  - Made the column `sort_order` on table `series` required. This step will fail if there are existing NULL values in that column.
  - Made the column `level` on table `series` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_active` on table `series` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."series" ALTER COLUMN "sort_order" SET NOT NULL,
ALTER COLUMN "level" SET NOT NULL,
ALTER COLUMN "is_active" SET NOT NULL;
