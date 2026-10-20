-- Phase 2A: thêm trạng thái pending/rejected cho developer_accounts.
-- Chỉ thêm giá trị enum; không đổi dữ liệu hiện có.
-- Tách riêng migration vì Postgres không cho dùng giá trị enum mới
-- (vd. làm DEFAULT) trong cùng transaction đã thêm nó.

ALTER TYPE "developer_status" ADD VALUE IF NOT EXISTS 'pending' BEFORE 'active';
ALTER TYPE "developer_status" ADD VALUE IF NOT EXISTS 'rejected' AFTER 'banned';
