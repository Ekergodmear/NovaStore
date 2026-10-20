-- Phase 2B: quản lý app và danh mục. Chỉ thêm; không cập nhật hay xóa hàng nào.

-- Danh mục có thể ẩn thay vì xóa (app đang dùng vẫn giữ danh mục).
ALTER TABLE "app_categories" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- Liên hệ hỗ trợ của app (nullable cho dữ liệu cũ; API bắt buộc support_email khi tạo).
ALTER TABLE "apps"
  ADD COLUMN "support_email" CITEXT,
  ADD COLUMN "support_url" TEXT;

-- Danh sách app của developer: lọc theo trạng thái, mới cập nhật trước.
CREATE INDEX "apps_developer_account_id_status_updated_at_idx"
  ON "apps"("developer_account_id", "status", "updated_at" DESC);
DROP INDEX "apps_developer_account_id_idx";

-- Định dạng package name Android ở tầng DB (Prisma không quản lý CHECK).
-- Nếu dữ liệu cũ vi phạm, migration dừng và rollback, không sửa dữ liệu.
ALTER TABLE "apps" ADD CONSTRAINT "apps_package_name_format"
  CHECK ("package_name" IS NULL OR "package_name" ~ '^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$');

-- Danh tính app bất biến ở tầng DB:
--   * developer_account_id không đổi được (không chuyển quyền sở hữu qua UPDATE).
--   * package_name chỉ được gán khi đang NULL, hoặc về NULL khi app chuyển sang archived
--     (giải phóng tên của app chưa từng phát hành). Mọi đổi tên khác bị chặn.
CREATE OR REPLACE FUNCTION apps_identity_guard() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF NEW.developer_account_id IS DISTINCT FROM OLD.developer_account_id THEN
    RAISE EXCEPTION 'apps.developer_account_id is immutable';
  END IF;
  IF NEW.package_name IS DISTINCT FROM OLD.package_name
     AND OLD.package_name IS NOT NULL
     AND NOT (NEW.package_name IS NULL AND NEW.status = 'archived') THEN
    RAISE EXCEPTION 'apps.package_name is immutable';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "apps_identity_guard"
  BEFORE UPDATE OF "developer_account_id", "package_name" ON "apps"
  FOR EACH ROW EXECUTE FUNCTION apps_identity_guard();
