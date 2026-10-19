# NovaStore — Acceptance Criteria

> Draft v0.1 · 2026-10-19 · MVP **chỉ hoàn thành** khi toàn bộ kịch bản E2E dưới đây pass trên staging, có test tự động hoặc biên bản test thủ công lưu trong `docs/qa/`.

## 1. Luồng end-to-end chính

### AC-01 Developer đăng ký & tạo app
- **Given** người dùng đã đăng nhập, chưa có developer account
- **When** tạo developer account và chấp nhận Developer Agreement
- **Then** account `active`, có `audit_logs` `developer.create`; user truy cập được Developer Console.
- **And** hoàn thành wizard bước 1–3 tạo app ở trạng thái `draft`; app **không** xuất hiện ở `GET /apps`.

### AC-02 Upload APK hợp lệ
- **When** upload APK release-signed, targetSdk ≥ ngưỡng, rồi submit
- **Then** trong ≤ 5 phút release chuyển `pending_review`; artifact có SHA-256 do server tính, package name, versionCode/Name, min/targetSdk, permissions, chứng chỉ ký khớp kết quả `apksigner`/`aapt2` chạy tay.
- **And** object chỉ tồn tại trong bucket `quarantine`; truy cập trực tiếp không ký → 403.

### AC-03 Từ chối tự động APK xấu
Mỗi APK trong bộ test bị reject với đúng mã:
| APK test | Mã kỳ vọng |
|---------|-----------|
| File không phải ZIP / hỏng | `APK_INVALID` |
| Zip bomb | `APK_INVALID` (worker không OOM, job kết thúc trong timeout) |
| Ký debug certificate | `DEBUG_CERTIFICATE` |
| `debuggable=true` | `DEBUGGABLE_BUILD` |
| Chứa mẫu EICAR | `SCAN_MALWARE_DETECTED` |
| Package `com.google.android.youtube` | `PACKAGE_TAKEN` |

### AC-04 Kiểm duyệt
- Moderator thấy release trong queue với SHA-256, chứng chỉ, permissions, findings.
- Reject bắt buộc có lý do → developer thấy lý do + email.
- Approve → release `published` trong ≤ 2 phút, artifact ở `public-artifacts` với key chứa SHA-256, hash bản public = hash bản quarantine.
- Moderator là member của developer account đó → `403 CONFLICT_OF_INTEREST`.
- Hai moderator approve đồng thời → chỉ một thành công, bên kia `409`.

### AC-05 Hiển thị trên Web và Android Store
- App xuất hiện ở home "Mới", danh mục, và tìm kiếm theo tên có/không dấu ("ghi chu" tìm thấy "Ghi chú").
- Trang chi tiết hiển thị đúng quyền, kích thước, SHA-256, chứng chỉ.

### AC-06 Tải và cài đặt
- Web: "Tải APK" trả 302 tới signed URL hết hạn sau ≤ 5 phút; `download_events` ghi 1 bản ghi; tải lại trong 24h từ cùng thiết bị không tăng `unique_downloads`.
- Android Store (Android 10 và 15, máy thật): tải → xác minh SHA-256 → dialog cài hệ thống → app mở được.
- File bị sửa 1 byte (giả lập MITM) → Store từ chối cài và báo lỗi.

### AC-07 Phát hành phiên bản mới
- Bản mới cùng keystore, versionCode lớn hơn → qua pipeline → publish; bản cũ `superseded`.
- Bản mới **khác keystore** → `RELEASE_SIGNATURE_MISMATCH`.
- Bản mới versionCode ≤ bản hiện hành → `VERSION_CODE_NOT_INCREASED`.
- Bản ký bằng key mới có v3 rotation lineage hợp lệ từ key cũ → chấp nhận và lineage được cập nhật.

### AC-08 Thông báo cập nhật
- Store với app cài bản cũ → tab Quản lý hiển thị "Có bản cập nhật" (trong ≤ 1 lần mở app hoặc kiểm định kỳ 24h); cập nhật thủ công thành công giữ nguyên dữ liệu app.
- App cùng package name nhưng cài từ nguồn khác (chữ ký khác) → **không** đề xuất cập nhật.

### AC-09 Gỡ & thu hồi
- Admin remove app → trong ≤ 5 phút: biến mất khỏi list/search/chi tiết (404/410), download trả 410, signed URL mới không được cấp.
- Admin revoke release → `/updates/check` trả mục `revoked`; Store hiển thị cảnh báo + nút gỡ.
- Suspend developer → mọi app của họ bị ẩn.
- Mọi thao tác trên có audit log với actor, before/after.

## 2. Tiêu chí bảo mật bắt buộc

- [ ] Mọi endpoint ghi có test tự động cho: không token → 401, sai role → 403, resource của người khác → 403/404 (IDOR).
- [ ] Không có đường dẫn nào trả object quarantine cho client ngoài presigned PUT.
- [ ] Worker sandbox xác minh: không ra mạng được (`curl` trong sandbox thất bại), không đọc được env secret, chạy non-root.
- [ ] Callback internal từ chối chữ ký HMAC sai hoặc timestamp cũ.
- [ ] Admin/Moderator console yêu cầu MFA.
- [ ] Không log token, signed URL, IP thô.
- [ ] Dependency scan (GitHub Dependabot/`pnpm audit`) không có lỗ hổng High/Critical chưa xử lý.
- [ ] Đã thử restore backup Postgres thành công trên môi trường tạm.

## 3. Tiêu chí phi chức năng

- [ ] API đọc catalog p95 < 300 ms với 100 app, 50 RPS (k6).
- [ ] Trang chi tiết app web LCP < 2.5 s (Lighthouse mobile).
- [ ] Lighthouse Accessibility ≥ 90 cho Home và App detail.
- [ ] Sentry nhận lỗi từ web, console, API, worker, Android.

## 4. Tiêu chí tài liệu & vận hành

- [ ] OpenAPI spec xuất bản cho nội bộ, khớp `API_CONTRACT.md`.
- [ ] Runbook: malware đã phát hành, lộ credential R2/Supabase, worker treo, DB đầy.
- [ ] Trang Điều khoản, Chính sách riêng tư, Developer Agreement, quy trình khiếu nại đã được rà soát pháp lý.
