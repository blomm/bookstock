-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."titles" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_retired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retired_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."title_status_history" (
    "id" SERIAL NOT NULL,
    "title_id" INTEGER NOT NULL,
    "from_status" "public"."TitleStatus" NOT NULL,
    "to_status" "public"."TitleStatus" NOT NULL,
    "reason" VARCHAR(500),
    "changed_by" VARCHAR(100),
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "title_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_log" (
    "id" SERIAL NOT NULL,
    "title_id" INTEGER NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "title_status_history_title_id_idx" ON "public"."title_status_history"("title_id");

-- CreateIndex
CREATE INDEX "title_status_history_from_status_idx" ON "public"."title_status_history"("from_status");

-- CreateIndex
CREATE INDEX "title_status_history_to_status_idx" ON "public"."title_status_history"("to_status");

-- CreateIndex
CREATE INDEX "title_status_history_changed_at_idx" ON "public"."title_status_history"("changed_at");

-- CreateIndex
CREATE INDEX "notification_log_title_id_idx" ON "public"."notification_log"("title_id");

-- CreateIndex
CREATE INDEX "notification_log_status_idx" ON "public"."notification_log"("status");

-- CreateIndex
CREATE INDEX "notification_log_sent_at_idx" ON "public"."notification_log"("sent_at");

-- CreateIndex
CREATE INDEX "notification_log_created_at_idx" ON "public"."notification_log"("created_at");

-- AddForeignKey
ALTER TABLE "public"."title_status_history" ADD CONSTRAINT "title_status_history_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_log" ADD CONSTRAINT "notification_log_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
