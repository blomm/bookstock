-- CreateEnum
CREATE TYPE "public"."Format" AS ENUM ('HARDCOVER', 'PAPERBACK', 'DIGITAL', 'AUDIOBOOK');

-- CreateEnum
CREATE TYPE "public"."MovementType" AS ENUM ('PRINT_RECEIVED', 'WAREHOUSE_TRANSFER', 'ONLINE_SALES', 'UK_TRADE_SALES', 'US_TRADE_SALES', 'ROW_TRADE_SALES', 'DIRECT_SALES', 'PULPED', 'DAMAGED', 'FREE_COPIES');

-- CreateTable
CREATE TABLE "public"."series" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."warehouses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "location" VARCHAR(100) NOT NULL,
    "fulfillsChannels" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."printers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(20),
    "location" VARCHAR(100),
    "contactEmail" VARCHAR(255),
    "contactPhone" VARCHAR(50),
    "website" VARCHAR(255),
    "specialties" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "printers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."titles" (
    "id" SERIAL NOT NULL,
    "isbn" VARCHAR(13) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "author" VARCHAR(255) NOT NULL,
    "format" "public"."Format" NOT NULL,
    "rrp" DECIMAL(8,2) NOT NULL,
    "unit_cost" DECIMAL(8,2) NOT NULL,
    "page_count" INTEGER,
    "publication_date" TIMESTAMP(3),
    "publisher" VARCHAR(255),
    "category" VARCHAR(100),
    "subcategory" VARCHAR(100),
    "dimensions" VARCHAR(50),
    "weight" INTEGER,
    "binding_type" VARCHAR(50),
    "cover_finish" VARCHAR(50),
    "trade_discount" DECIMAL(5,2),
    "royalty_rate" DECIMAL(5,2),
    "royalty_threshold" INTEGER,
    "print_run_size" INTEGER,
    "reprint_threshold" INTEGER,
    "description" TEXT,
    "keywords" VARCHAR(500),
    "language" VARCHAR(10),
    "territory_rights" VARCHAR(200),
    "series_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory" (
    "id" SERIAL NOT NULL,
    "title_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "current_stock" INTEGER NOT NULL,
    "reserved_stock" INTEGER NOT NULL DEFAULT 0,
    "last_movement_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."price_history" (
    "id" SERIAL NOT NULL,
    "title_id" INTEGER NOT NULL,
    "rrp" DECIMAL(8,2) NOT NULL,
    "unit_cost" DECIMAL(8,2),
    "trade_discount" DECIMAL(5,2),
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_movements" (
    "id" SERIAL NOT NULL,
    "title_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "movement_type" "public"."MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "movement_date" TIMESTAMP(3) NOT NULL,
    "rrp_at_time" DECIMAL(8,2),
    "unit_cost_at_time" DECIMAL(8,2),
    "trade_discount_at_time" DECIMAL(5,2),
    "source_warehouse_id" INTEGER,
    "destination_warehouse_id" INTEGER,
    "printer_id" INTEGER,
    "reference_number" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "clerk_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_by" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(100),
    "resource_id" TEXT,
    "details" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "series_name_key" ON "public"."series"("name");

-- CreateIndex
CREATE INDEX "series_name_idx" ON "public"."series"("name");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "public"."warehouses"("code");

-- CreateIndex
CREATE INDEX "warehouses_code_idx" ON "public"."warehouses"("code");

-- CreateIndex
CREATE INDEX "warehouses_is_active_idx" ON "public"."warehouses"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "printers_code_key" ON "public"."printers"("code");

-- CreateIndex
CREATE INDEX "printers_name_idx" ON "public"."printers"("name");

-- CreateIndex
CREATE INDEX "printers_code_idx" ON "public"."printers"("code");

-- CreateIndex
CREATE INDEX "printers_is_active_idx" ON "public"."printers"("is_active");

-- CreateIndex
CREATE INDEX "printers_location_idx" ON "public"."printers"("location");

-- CreateIndex
CREATE UNIQUE INDEX "titles_isbn_key" ON "public"."titles"("isbn");

-- CreateIndex
CREATE INDEX "titles_isbn_idx" ON "public"."titles"("isbn");

-- CreateIndex
CREATE INDEX "titles_title_idx" ON "public"."titles"("title");

-- CreateIndex
CREATE INDEX "titles_author_idx" ON "public"."titles"("author");

-- CreateIndex
CREATE INDEX "titles_series_id_idx" ON "public"."titles"("series_id");

-- CreateIndex
CREATE INDEX "titles_format_idx" ON "public"."titles"("format");

-- CreateIndex
CREATE INDEX "titles_category_idx" ON "public"."titles"("category");

-- CreateIndex
CREATE INDEX "titles_publisher_idx" ON "public"."titles"("publisher");

-- CreateIndex
CREATE INDEX "titles_publication_date_idx" ON "public"."titles"("publication_date");

-- CreateIndex
CREATE INDEX "inventory_title_id_idx" ON "public"."inventory"("title_id");

-- CreateIndex
CREATE INDEX "inventory_warehouse_id_idx" ON "public"."inventory"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_current_stock_idx" ON "public"."inventory"("current_stock");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_title_id_warehouse_id_key" ON "public"."inventory"("title_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "price_history_title_id_idx" ON "public"."price_history"("title_id");

-- CreateIndex
CREATE INDEX "price_history_effective_from_idx" ON "public"."price_history"("effective_from");

-- CreateIndex
CREATE INDEX "price_history_effective_to_idx" ON "public"."price_history"("effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "price_history_title_id_effective_from_key" ON "public"."price_history"("title_id", "effective_from");

-- CreateIndex
CREATE INDEX "stock_movements_title_id_idx" ON "public"."stock_movements"("title_id");

-- CreateIndex
CREATE INDEX "stock_movements_warehouse_id_idx" ON "public"."stock_movements"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_movements_movement_type_idx" ON "public"."stock_movements"("movement_type");

-- CreateIndex
CREATE INDEX "stock_movements_movement_date_idx" ON "public"."stock_movements"("movement_date");

-- CreateIndex
CREATE INDEX "stock_movements_source_warehouse_id_idx" ON "public"."stock_movements"("source_warehouse_id");

-- CreateIndex
CREATE INDEX "stock_movements_destination_warehouse_id_idx" ON "public"."stock_movements"("destination_warehouse_id");

-- CreateIndex
CREATE INDEX "stock_movements_printer_id_idx" ON "public"."stock_movements"("printer_id");

-- CreateIndex
CREATE INDEX "stock_movements_rrp_at_time_idx" ON "public"."stock_movements"("rrp_at_time");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_id_key" ON "public"."users"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_clerk_id_idx" ON "public"."users"("clerk_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "public"."users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "public"."roles"("name");

-- CreateIndex
CREATE INDEX "roles_name_idx" ON "public"."roles"("name");

-- CreateIndex
CREATE INDEX "roles_is_active_idx" ON "public"."roles"("is_active");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "public"."user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "public"."user_roles"("role_id");

-- CreateIndex
CREATE INDEX "user_roles_is_active_idx" ON "public"."user_roles"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "public"."user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "public"."audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "public"."audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "public"."audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "public"."audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "public"."titles" ADD CONSTRAINT "titles_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory" ADD CONSTRAINT "inventory_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory" ADD CONSTRAINT "inventory_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_history" ADD CONSTRAINT "price_history_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_source_warehouse_id_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
