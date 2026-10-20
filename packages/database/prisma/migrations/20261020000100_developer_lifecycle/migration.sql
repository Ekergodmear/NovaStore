-- Phase 2A: vòng đời developer account và ràng buộc một user ↔ một developer account.
-- An toàn với dữ liệu hiện có:
--   * Cột mới đều cho phép NULL; không cập nhật hàng nào.
--   * Chỉ đổi DEFAULT cho bản ghi tạo sau này; tài khoản đang active giữ nguyên.
--   * Nếu đã có user thuộc nhiều developer account, CREATE UNIQUE INDEX sẽ thất bại
--     và toàn bộ migration rollback — cần xử lý thủ công, không có dữ liệu nào bị xóa.

-- AlterTable
ALTER TABLE "developer_accounts"
  ADD COLUMN "status_changed_at" TIMESTAMPTZ(6),
  ADD COLUMN "status_reason" VARCHAR(500),
  ALTER COLUMN "status" SET DEFAULT 'pending';

-- Thay index thường bằng unique index trên cùng cột.
-- CreateIndex
CREATE UNIQUE INDEX "developer_members_user_id_key" ON "developer_members"("user_id");

-- DropIndex
DROP INDEX "developer_members_user_id_idx";
