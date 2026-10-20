-- Phase 2B: vòng đời app.
-- RENAME VALUE giữ nguyên mọi hàng đang ở 'in_review' (chúng tự thành 'pending_review'),
-- không ép kiểu hay tạo lại enum. Chỉ thêm giá trị mới; không đổi dữ liệu.
-- Tách khỏi migration dùng giá trị mới vì Postgres không cho dùng giá trị enum
-- trong cùng transaction đã thêm nó.

ALTER TYPE "app_status" RENAME VALUE 'in_review' TO 'pending_review';
ALTER TYPE "app_status" ADD VALUE IF NOT EXISTS 'rejected' AFTER 'published';
ALTER TYPE "app_status" ADD VALUE IF NOT EXISTS 'suspended' AFTER 'rejected';
ALTER TYPE "app_status" ADD VALUE IF NOT EXISTS 'archived' AFTER 'removed';
