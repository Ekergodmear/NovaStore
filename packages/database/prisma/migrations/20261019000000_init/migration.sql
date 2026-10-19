-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "platform_role" AS ENUM ('user', 'moderator', 'admin');

-- CreateEnum
CREATE TYPE "developer_verification_status" AS ENUM ('unverified', 'email_verified', 'verified');

-- CreateEnum
CREATE TYPE "developer_status" AS ENUM ('active', 'suspended', 'banned');

-- CreateEnum
CREATE TYPE "developer_member_role" AS ENUM ('owner', 'admin', 'editor');

-- CreateEnum
CREATE TYPE "content_rating" AS ENUM ('everyone', 'teen', 'mature');

-- CreateEnum
CREATE TYPE "app_status" AS ENUM ('draft', 'in_review', 'published', 'unlisted', 'removed');

-- CreateEnum
CREATE TYPE "media_type" AS ENUM ('icon', 'feature_graphic', 'screenshot_phone', 'screenshot_tablet');

-- CreateEnum
CREATE TYPE "media_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "release_status" AS ENUM ('draft', 'uploading', 'processing', 'pending_review', 'approved', 'rejected', 'published', 'superseded', 'revoked');

-- CreateEnum
CREATE TYPE "scan_verdict" AS ENUM ('pass', 'warn', 'fail', 'error');

-- CreateEnum
CREATE TYPE "moderation_decision" AS ENUM ('approve', 'reject', 'request_changes');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('visible', 'hidden', 'removed');

-- CreateEnum
CREATE TYPE "report_reason" AS ENUM ('malware', 'impersonation', 'copyright', 'inappropriate', 'privacy', 'other');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('open', 'triaged', 'actioned', 'dismissed');

-- CreateEnum
CREATE TYPE "download_client" AS ENUM ('web', 'android_store');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" CITEXT,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "status" "user_status" NOT NULL DEFAULT 'active',
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role" "platform_role" NOT NULL,
    "granted_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateTable
CREATE TABLE "developer_accounts" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "contact_email" CITEXT NOT NULL,
    "website" TEXT,
    "verification_status" "developer_verification_status" NOT NULL DEFAULT 'unverified',
    "status" "developer_status" NOT NULL DEFAULT 'active',
    "agreement_version" TEXT NOT NULL,
    "agreement_accepted_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "developer_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developer_members" (
    "developer_account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "member_role" "developer_member_role" NOT NULL DEFAULT 'owner',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "developer_members_pkey" PRIMARY KEY ("developer_account_id","user_id")
);

-- CreateTable
CREATE TABLE "app_categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_vi" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "parent_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apps" (
    "id" UUID NOT NULL,
    "developer_account_id" UUID NOT NULL,
    "package_name" TEXT,
    "pending_package_name" TEXT,
    "signer_lineage_sha256" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "slug" CITEXT NOT NULL,
    "title" VARCHAR(50) NOT NULL,
    "short_description" VARCHAR(80) NOT NULL,
    "full_description" VARCHAR(4000) NOT NULL,
    "category_id" UUID NOT NULL,
    "content_rating" "content_rating" NOT NULL DEFAULT 'everyone',
    "contains_ads" BOOLEAN NOT NULL DEFAULT false,
    "privacy_policy_url" TEXT,
    "default_locale" TEXT NOT NULL DEFAULT 'vi',
    "status" "app_status" NOT NULL DEFAULT 'draft',
    "removed_reason" TEXT,
    "current_release_id" UUID,
    "rating_avg" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" BIGINT NOT NULL DEFAULT 0,
    "search_vector" tsvector,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_media" (
    "id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "type" "media_type" NOT NULL,
    "r2_key" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "media_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_releases" (
    "id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "version_code" BIGINT,
    "version_name" TEXT,
    "changelog_vi" VARCHAR(500),
    "changelog_en" VARCHAR(500),
    "status" "release_status" NOT NULL DEFAULT 'draft',
    "rejection_reason_code" TEXT,
    "rejection_note" TEXT,
    "submitted_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_artifacts" (
    "id" UUID NOT NULL,
    "release_id" UUID NOT NULL,
    "quarantine_key" TEXT NOT NULL,
    "public_key" TEXT,
    "size_bytes" BIGINT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "package_name" TEXT NOT NULL,
    "version_code" BIGINT NOT NULL,
    "version_name" TEXT NOT NULL,
    "min_sdk" INTEGER NOT NULL,
    "target_sdk" INTEGER NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "native_abis" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "signing_schemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "signer_cert_sha256" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "signer_lineage" JSONB,
    "manifest_summary" JSONB NOT NULL DEFAULT '{}',
    "uploaded_sha256_claimed" CHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "release_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_scan_results" (
    "id" UUID NOT NULL,
    "release_id" UUID NOT NULL,
    "scanner" TEXT NOT NULL,
    "scanner_version" TEXT NOT NULL,
    "verdict" "scan_verdict" NOT NULL,
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "findings" JSONB NOT NULL DEFAULT '[]',
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "release_scan_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_reviews" (
    "id" UUID NOT NULL,
    "release_id" UUID NOT NULL,
    "moderator_id" UUID NOT NULL,
    "decision" "moderation_decision" NOT NULL,
    "reason_code" TEXT,
    "note" TEXT,
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_reviews" (
    "id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "body" VARCHAR(1000),
    "version_code" BIGINT,
    "status" "review_status" NOT NULL DEFAULT 'visible',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_replies" (
    "review_id" UUID NOT NULL,
    "developer_account_id" UUID NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "review_replies_pkey" PRIMARY KEY ("review_id")
);

-- CreateTable
CREATE TABLE "app_reports" (
    "id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "release_id" UUID,
    "reporter_id" UUID,
    "reason" "report_reason" NOT NULL,
    "details" VARCHAR(2000),
    "status" "report_status" NOT NULL DEFAULT 'open',
    "handled_by" UUID,
    "resolution_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_events" (
    "id" BIGSERIAL NOT NULL,
    "app_id" UUID NOT NULL,
    "release_id" UUID NOT NULL,
    "user_id" UUID,
    "client" "download_client" NOT NULL,
    "client_fingerprint" CHAR(64) NOT NULL,
    "country" CHAR(2),
    "is_counted" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_daily_stats" (
    "app_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "unique_downloads" INTEGER NOT NULL DEFAULT 0,
    "new_reviews" INTEGER NOT NULL DEFAULT 0,
    "rating_sum" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "app_daily_stats_pkey" PRIMARY KEY ("app_id","date")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" UUID,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip_hash" CHAR(64),
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "developer_accounts_slug_key" ON "developer_accounts"("slug");

-- CreateIndex
CREATE INDEX "developer_members_user_id_idx" ON "developer_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_categories_slug_key" ON "app_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "apps_package_name_key" ON "apps"("package_name");

-- CreateIndex
CREATE UNIQUE INDEX "apps_slug_key" ON "apps"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "apps_current_release_id_key" ON "apps"("current_release_id");

-- CreateIndex
CREATE INDEX "apps_developer_account_id_idx" ON "apps"("developer_account_id");

-- CreateIndex
CREATE INDEX "apps_status_category_id_download_count_idx" ON "apps"("status", "category_id", "download_count" DESC);

-- CreateIndex
CREATE INDEX "app_media_app_id_type_sort_order_idx" ON "app_media"("app_id", "type", "sort_order");

-- CreateIndex
CREATE INDEX "app_releases_status_submitted_at_idx" ON "app_releases"("status", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_releases_app_id_version_code_key" ON "app_releases"("app_id", "version_code");

-- CreateIndex
CREATE UNIQUE INDEX "release_artifacts_release_id_key" ON "release_artifacts"("release_id");

-- CreateIndex
CREATE INDEX "release_artifacts_sha256_idx" ON "release_artifacts"("sha256");

-- CreateIndex
CREATE INDEX "release_artifacts_package_name_idx" ON "release_artifacts"("package_name");

-- CreateIndex
CREATE INDEX "release_scan_results_release_id_idx" ON "release_scan_results"("release_id");

-- CreateIndex
CREATE INDEX "moderation_reviews_release_id_created_at_idx" ON "moderation_reviews"("release_id", "created_at");

-- CreateIndex
CREATE INDEX "app_reviews_app_id_status_created_at_idx" ON "app_reviews"("app_id", "status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "app_reviews_app_id_user_id_key" ON "app_reviews"("app_id", "user_id");

-- CreateIndex
CREATE INDEX "app_reports_status_created_at_idx" ON "app_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "app_reports_app_id_idx" ON "app_reports"("app_id");

-- CreateIndex
CREATE INDEX "download_events_app_id_created_at_idx" ON "download_events"("app_id", "created_at");

-- CreateIndex
CREATE INDEX "download_events_client_fingerprint_app_id_created_at_idx" ON "download_events"("client_fingerprint", "app_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_created_at_idx" ON "audit_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_members" ADD CONSTRAINT "developer_members_developer_account_id_fkey" FOREIGN KEY ("developer_account_id") REFERENCES "developer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_members" ADD CONSTRAINT "developer_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_categories" ADD CONSTRAINT "app_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "app_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apps" ADD CONSTRAINT "apps_developer_account_id_fkey" FOREIGN KEY ("developer_account_id") REFERENCES "developer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apps" ADD CONSTRAINT "apps_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "app_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apps" ADD CONSTRAINT "apps_current_release_id_fkey" FOREIGN KEY ("current_release_id") REFERENCES "app_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_media" ADD CONSTRAINT "app_media_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_artifacts" ADD CONSTRAINT "release_artifacts_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "app_releases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_scan_results" ADD CONSTRAINT "release_scan_results_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "app_releases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reviews" ADD CONSTRAINT "moderation_reviews_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "app_releases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reviews" ADD CONSTRAINT "moderation_reviews_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_reviews" ADD CONSTRAINT "app_reviews_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_reviews" ADD CONSTRAINT "app_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "app_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_developer_account_id_fkey" FOREIGN KEY ("developer_account_id") REFERENCES "developer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_reports" ADD CONSTRAINT "app_reports_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_reports" ADD CONSTRAINT "app_reports_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "app_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_reports" ADD CONSTRAINT "app_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_reports" ADD CONSTRAINT "app_reports_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "app_releases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_daily_stats" ADD CONSTRAINT "app_daily_stats_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────
-- Phần viết tay: Prisma không biểu diễn được các đối tượng dưới đây.
-- ─────────────────────────────────────────────────────────────────────

-- unaccent() không IMMUTABLE nên không dùng trực tiếp trong generated column/index.
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- Tìm kiếm full-text không phân biệt dấu ("ghi chu" khớp "Ghi chú").
ALTER TABLE "apps" DROP COLUMN "search_vector";
ALTER TABLE "apps" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', immutable_unaccent(coalesce("title", ''))), 'A') ||
  setweight(to_tsvector('simple', immutable_unaccent(coalesce("short_description", ''))), 'B') ||
  setweight(to_tsvector('simple', immutable_unaccent(coalesce("full_description", ''))), 'C')
) STORED;

CREATE INDEX "apps_search_vector_idx" ON "apps" USING GIN ("search_vector");
CREATE INDEX "apps_title_trgm_idx" ON "apps" USING GIN (immutable_unaccent(lower("title")) gin_trgm_ops);

-- Ràng buộc dữ liệu.
ALTER TABLE "app_reviews" ADD CONSTRAINT "app_reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "release_scan_results" ADD CONSTRAINT "release_scan_results_risk_range" CHECK ("risk_score" BETWEEN 0 AND 100);
ALTER TABLE "release_artifacts" ADD CONSTRAINT "release_artifacts_sha256_hex" CHECK ("sha256" ~ '^[a-f0-9]{64}$');

-- audit_logs là append-only: chặn UPDATE/DELETE/TRUNCATE ở tầng DB.
CREATE OR REPLACE FUNCTION audit_logs_block_mutation() RETURNS trigger
  LANGUAGE plpgsql
  AS $$ BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END $$;

CREATE TRIGGER "audit_logs_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();

CREATE TRIGGER "audit_logs_no_truncate"
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_block_mutation();

-- release_artifacts bất biến, trừ việc gán public_key một lần khi publish.
CREATE OR REPLACE FUNCTION release_artifacts_immutable() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'release_artifacts is immutable';
  END IF;
  IF OLD.public_key IS NOT NULL OR NEW.public_key IS NULL
     OR (to_jsonb(NEW) - 'public_key') <> (to_jsonb(OLD) - 'public_key') THEN
    RAISE EXCEPTION 'release_artifacts is immutable (only public_key may be set once)';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "release_artifacts_immutable"
  BEFORE UPDATE OR DELETE ON "release_artifacts"
  FOR EACH ROW EXECUTE FUNCTION release_artifacts_immutable();
