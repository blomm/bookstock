-- Add hierarchy support to Series model
ALTER TABLE "series" ADD COLUMN "parent_id" INTEGER;
ALTER TABLE "series" ADD COLUMN "sort_order" INTEGER DEFAULT 0;
ALTER TABLE "series" ADD COLUMN "level" INTEGER DEFAULT 0;
ALTER TABLE "series" ADD COLUMN "is_active" BOOLEAN DEFAULT true;

-- Add foreign key constraint for hierarchy
ALTER TABLE "series" ADD CONSTRAINT "series_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "series" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for performance
CREATE INDEX "series_parent_id_idx" ON "series" ("parent_id");
CREATE INDEX "series_sort_order_idx" ON "series" ("sort_order");
CREATE INDEX "series_level_idx" ON "series" ("level");
CREATE INDEX "series_is_active_idx" ON "series" ("is_active");