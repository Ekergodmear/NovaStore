# NovaStore — API Contract

> Draft v0.1 · REST/JSON · Base URL `/api/v1` · 2026-10-19
> Nguồn chuẩn khi triển khai: OpenAPI sinh từ NestJS + Zod schemas trong `packages/validation`. Tài liệu này là hợp đồng thiết kế.

## 1. Quy ước chung

- **Auth**: `Authorization: Bearer <Supabase JWT>`. Ký hiệu cột Auth: `—` công khai, `U` user, `D` developer member của resource, `M` moderator, `A` admin.
- **Request ID**: client có thể gửi `X-Request-Id`; server luôn trả lại header này.
- **Idempotency**: các POST tạo resource/hành động nhạy cảm nhận `Idempotency-Key` (lưu 24h trong Redis).
- **Phân trang**: cursor — `?limit=20&cursor=<opaque>` → `{ data: [], nextCursor: string|null }`.
- **Lỗi** (RFC 9457 Problem Details):
```json
{ "type": "https://novastore.dev/errors/signature-mismatch",
  "title": "Signing certificate does not match",
  "status": 422, "code": "RELEASE_SIGNATURE_MISMATCH",
  "detail": "…", "requestId": "…" }
```
- **Rate limit** (Redis sliding window), trả `429` + `Retry-After`:
  | Nhóm | Giới hạn |
  |------|---------|
  | Đọc công khai | 120 req/phút/IP |
  | Download | 30 req/phút/IP |
  | Ghi (review, report) | 10 req/phút/user |
  | Upload session | 20/giờ/developer account |
- **Audit**: mọi endpoint đánh dấu ✍ ghi `audit_logs`.

## 2. Identity & Developer account

> **Đã triển khai (Phase 2A).** Tài liệu máy đọc được: `GET /api/openapi.json`, giao diện tại `/api/docs` (bật mặc định ngoài production, cờ `OPENAPI_ENABLED`). Request schema sinh trực tiếp từ Zod trong `packages/validation`.

| Method | Path | Auth | Mô tả |
|--------|------|------|------|
| GET | `/me` | U | Profile + roles + developer account (kèm `status`) |
| PATCH | `/me` | U | Sửa display name/avatar |
| POST | `/developers` ✍ | U | Đăng ký developer account; người gọi thành owner; bắt đầu `pending` |
| GET | `/developers/me` | D | Hồ sơ riêng tư của developer hiện tại |
| PATCH | `/developers/me` ✍ | D(owner/admin) | Sửa `displayName`, `contactEmail`, `website` |
| GET | `/developers/me/status` | D | Trạng thái, lý do, quyền hiện hành |
| GET | `/developers/:slug` | — | Hồ sơ công khai, **chỉ developer `active`**, không có email |
| GET | `/developer/accounts/:developerAccountId` | D | Như `/developers/me` nhưng theo id |
| PATCH | `/developer/accounts/:developerAccountId` ✍ | D(owner/admin) | Như `PATCH /developers/me` nhưng theo id |

Quy tắc chung:
- **Danh tính chỉ lấy từ JWT.** Không endpoint nào nhận `userId`, `developerAccountId` hay `status` từ body/query/header để phân quyền. Body dùng schema `.strict()`: mọi trường lạ → `400 VALIDATION_FAILED`.
- **Chính sách 403/404:** id sai định dạng → `400 VALIDATION_FAILED`; id không tồn tại **hoặc thuộc developer khác** → `404 NOT_FOUND` với body giống hệt nhau. `403` chỉ dùng cho quyền của chính người gọi (chưa có account, account bị khóa, vai trò không đủ).
- Rate limit: `POST /developers` 5/phút, các `PATCH` 20/phút (theo IP).

`POST /developers`
```json
// request
{ "slug": "acme-studio", "displayName": "Acme Studio",
  "contactEmail": "dev@acme.vn", "website": "https://acme.vn",
  "agreementVersion": "2026-10" }
// 201
{ "id": "…", "slug": "acme-studio", "displayName": "Acme Studio", "contactEmail": "dev@acme.vn",
  "website": "https://acme.vn", "status": "pending", "statusReason": null, "statusChangedAt": null,
  "verificationStatus": "unverified", "memberRole": "owner", "agreementVersion": "2026-10",
  "agreementAcceptedAt": "…", "createdAt": "…", "updatedAt": "…",
  "capabilities": { "canManageProfile": true, "canPublish": false } }
```

Mã lỗi riêng:
| Mã | HTTP | Khi nào |
|----|------|--------|
| `DEVELOPER_ACCOUNT_REQUIRED` | 403 | Route developer nhưng user chưa đăng ký |
| `DEVELOPER_ACCOUNT_EXISTS` | 409 | User đã có developer account (kể cả request đồng thời) |
| `DEVELOPER_SLUG_TAKEN` | 409 | Slug đã dùng (không phân biệt hoa thường) |
| `AGREEMENT_VERSION_MISMATCH` | 400 | `agreementVersion` khác phiên bản hiện hành (`2026-10`) |
| `DEVELOPER_ACCOUNT_NOT_ACTIVE` | 403 | Trạng thái không cho phép thao tác (vd. sửa hồ sơ khi `suspended`) |
| `DEVELOPER_ROLE_INSUFFICIENT` | 403 | Thành viên `editor` sửa hồ sơ |
| `INVALID_STATUS_TRANSITION` | 409 | Staff chuyển trạng thái không hợp lệ hoặc trạng thái vừa bị người khác đổi |
| `CONFLICT_OF_INTEREST` | 403 | Staff đổi trạng thái account mà chính mình là thành viên |

Slug dành riêng (không đăng ký được): `me`, `admin`, `api`, `app`, `apps`, `developer`, `developers`, `help`, `moderator`, `novastore`, `official`, `security`, `support`, `system`.

## 3. Catalog (công khai)

| Method | Path | Auth | Mô tả |
|--------|------|------|------|
| GET | `/categories` | — | Danh mục |
| GET | `/apps` | — | Danh sách/tìm kiếm: `q`, `category`, `developer`, `sort=popular\|new\|rating` |
| GET | `/apps/:idOrSlug` | — | Chi tiết app (chỉ `published`/`unlisted`) |
| GET | `/apps/:id/releases` | — | Lịch sử phiên bản đã publish (changelog) |
| GET | `/home` | — | Feed trang chủ: featured, mới, phổ biến theo danh mục |

`GET /apps/:idOrSlug` — 200
```json
{ "id": "…", "slug": "acme-notes", "packageName": "vn.acme.notes",
  "title": "Acme Notes", "shortDescription": "…", "fullDescription": "…",
  "developer": { "slug": "acme-studio", "displayName": "Acme Studio", "verified": true },
  "category": { "slug": "productivity", "name": "Năng suất" },
  "icon": "https://media.novastore…/icon.png", "screenshots": ["…"],
  "rating": { "avg": 4.6, "count": 128 }, "downloads": 5300,
  "contentRating": "everyone", "containsAds": false, "privacyPolicyUrl": "…",
  "currentRelease": { "id": "…", "versionName": "2.1.0", "versionCode": 210,
    "sizeBytes": 18234567, "sha256": "…", "minSdk": 26, "targetSdk": 35,
    "permissions": [{ "name": "android.permission.CAMERA", "sensitive": true }],
    "signerCertSha256": ["…"], "publishedAt": "2026-10-01T03:00:00Z" } }
```

## 4. Developer — App & Release

| Method | Path | Auth | Mô tả |
|--------|------|------|------|
| GET | `/developer/apps` | D | App của các developer account mình thuộc về |
| POST | `/apps` ✍ | D | Tạo app (draft) |
| PATCH | `/apps/:id` ✍ | D | Sửa metadata (đổi listing app đã publish → cần duyệt lại media/text) |
| POST | `/apps/:id/media/upload-session` | D | Presigned PUT cho icon/screenshot |
| DELETE | `/apps/:id/media/:mediaId` ✍ | D | Gỡ media |
| POST | `/apps/:id/releases` ✍ | D | Tạo release draft |
| GET | `/apps/:id/releases/:releaseId` | D | Chi tiết + trạng thái + kết quả scan (rút gọn) |
| POST | `/releases/:id/upload-session` ✍ | D | Presigned PUT vào quarantine |
| POST | `/releases/:id/submit` ✍ | D | Xác nhận upload xong → enqueue processing |
| POST | `/releases/:id/cancel` ✍ | D | Hủy release chưa publish |
| GET | `/developer/apps/:id/stats` | D | `?from&to` downloads theo ngày |
| GET | `/developer/apps/:id/reviews` | D | Review + filter theo sao |
| PUT | `/reviews/:id/reply` ✍ | D | Trả lời review |

`POST /releases/:id/upload-session`
```json
// request
{ "fileName": "app-release.apk", "sizeBytes": 18234567, "sha256": "…(tùy chọn)" }
// 201
{ "uploadUrl": "https://<r2>/quarantine/…?X-Amz-Signature=…",
  "method": "PUT", "headers": { "Content-Type": "application/vnd.android.package-archive" },
  "expiresAt": "2026-10-19T10:15:00Z", "maxSizeBytes": 209715200 }
```
Ràng buộc: URL TTL 15 phút, 1 object/release, `Content-Length` khớp `sizeBytes`. File > 100 MB: dùng multipart (`/upload-session` trả `uploadId` + part URLs — chi tiết khi triển khai).

`POST /releases/:id/submit` — 202
```json
{ "releaseId": "…", "status": "processing" }
```
Lỗi có thể có: `409 RELEASE_NOT_UPLOADED`, `409 RELEASE_INVALID_STATE`.

Kết quả xử lý được trả qua `GET /apps/:id/releases/:releaseId` (poll 5s hoặc SSE `GET /releases/:id/events` — *quyết định mở*). Các lỗi nghiệp vụ worker trả về dạng `rejectionReasonCode`:
`APK_INVALID`, `APK_TOO_LARGE`, `PACKAGE_MISMATCH`, `PACKAGE_TAKEN`, `VERSION_CODE_NOT_INCREASED`, `RELEASE_SIGNATURE_MISMATCH`, `DEBUG_CERTIFICATE`, `DEBUGGABLE_BUILD`, `TARGET_SDK_TOO_LOW`, `SCAN_MALWARE_DETECTED`.

## 5. Moderation & Admin

| Method | Path | Auth | Mô tả |
|--------|------|------|------|
| GET | `/moderation/queue` | M | `?status=pending_review&sort=risk\|age` |
| GET | `/moderation/releases/:id` | M | Toàn bộ artifact metadata, scan findings, lịch sử, diff với bản trước |
| POST | `/moderation/releases/:id/approve` ✍ | M | Body: `{ checklist, note? }` |
| POST | `/moderation/releases/:id/reject` ✍ | M | Body: `{ reasonCode, note }` (bắt buộc) |
| GET | `/moderation/reports` | M | Báo cáo vi phạm |
| POST | `/moderation/reports/:id/resolve` ✍ | M | `{ action: dismiss\|request_changes\|remove_app\|revoke_release, note }` |
| POST | `/admin/apps/:id/remove` ✍ | A | Gỡ app khỏi store |
| POST | `/admin/apps/:id/restore` ✍ | A | Khôi phục |
| POST | `/admin/releases/:id/revoke` ✍ | A | Thu hồi release |
| GET | `/admin/developers` | M | **Đã triển khai.** `?status=&limit=&cursor=`; trả `{ data, nextCursor }` |
| GET | `/admin/developers/:developerAccountId` | M | **Đã triển khai.** Chi tiết + `allowedTransitions` |
| POST | `/admin/developers/:developerAccountId/status` ✍ | M (banned: A) | **Đã triển khai.** Đổi trạng thái developer (thay cho `/suspend` trong bản thiết kế đầu) |
| POST | `/admin/users/:id/roles` ✍ | A | Gán/gỡ moderator/admin |
| GET | `/admin/audit-logs` | A | Lọc theo actor/target/action |
| GET | `/admin/dashboard` | M | **Đã triển khai (Phase 1).** KPI: pending, mới gửi, bị report, dev hoạt động, tỉ lệ duyệt |

Moderator **không được** approve release của developer account mà họ là member → `403 CONFLICT_OF_INTEREST`. Approve dùng optimistic lock (`expectedStatus: "pending_review"`) để tránh hai moderator xử lý trùng.

`POST /admin/developers/:developerAccountId/status`
```json
// request — reason bắt buộc khi status là rejected | suspended | banned
{ "status": "suspended", "reason": "Vi phạm chính sách nội dung" }
// 200
{ "id": "…", "status": "suspended", "statusReason": "Vi phạm chính sách nội dung",
  "statusChangedAt": "…", "allowedTransitions": ["active", "banned"], "…": "…" }
```
- Chuyển hợp lệ: `pending → active | rejected`, `active → suspended | banned`, `suspended → active | banned`. `rejected`, `banned` là trạng thái kết thúc. Sai → `409 INVALID_STATUS_TRANSITION`.
- `banned` chỉ Admin; Moderator → `403 FORBIDDEN`. Mọi route `/admin/*` cần MFA (`aal2`) khi `REQUIRE_STAFF_MFA` bật (mặc định ở production).
- Cập nhật có điều kiện `WHERE status = <trạng thái đã đọc>`: hai staff thao tác cùng lúc thì một người nhận `409`.
- Ghi `audit_logs` (`developer.status.change`) cùng transaction, gồm trạng thái và lý do trước/sau.

## 6. Download & Update

| Method | Path | Auth | Mô tả |
|--------|------|------|------|
| GET | `/apps/:id/download` | — | 302 → signed URL (TTL 5 phút); `?releaseId` tùy chọn (chỉ bản published hiện hành) |
| POST | `/updates/check` | — (U tùy chọn) | Kiểm cập nhật hàng loạt cho Android Store |

> Thay đổi so với đề xuất ban đầu: `GET /apps/:id/updates` được gộp thành `POST /updates/check` để Store kiểm tất cả app trong 1 request.

`POST /updates/check`
```json
// request (tối đa 500 items)
{ "installed": [
  { "packageName": "vn.acme.notes", "versionCode": 200, "signerSha256": ["ab12…"] } ] }
// 200
{ "updates": [
    { "packageName": "vn.acme.notes", "appId": "…", "versionCode": 210, "versionName": "2.1.0",
      "sizeBytes": 18234567, "sha256": "…", "downloadPath": "/api/v1/apps/…/download" } ],
  "revoked": [
    { "packageName": "vn.bad.app", "versionCode": 5, "reason": "malware", "advice": "uninstall" } ] }
```
Chỉ trả update khi `signerSha256` máy khớp lineage của app — app cùng package name nhưng ký khác (cài từ nguồn khác) sẽ không được đề xuất.

## 7. Reviews & Reports (người dùng)

| Method | Path | Auth | Mô tả |
|--------|------|------|------|
| GET | `/apps/:id/reviews` | — | `?sort=recent\|helpful&rating=` |
| PUT | `/apps/:id/reviews/me` ✍ | U | Tạo/sửa review của mình (`rating`, `body`) |
| DELETE | `/apps/:id/reviews/me` ✍ | U | Xóa review của mình |
| POST | `/apps/:id/reports` ✍ | U | `{ reason, details, releaseId? }` |
| GET | `/me/library` | U | App đã tải/lưu |
| PUT/DELETE | `/me/library/:appId` | U | Lưu/bỏ lưu |

> Thay đổi: `POST /apps/:id/reviews` → `PUT /apps/:id/reviews/me` vì mỗi user chỉ có 1 review/app (idempotent).

## 8. Internal (worker ↔ API)

| Method | Path | Auth | Mô tả |
|--------|------|------|------|
| POST | `/internal/releases/:id/processing-result` | HMAC | Worker gửi kết quả inspect/scan |

Header `X-Signature: sha256=<HMAC(body, WORKER_SECRET)>` + `X-Timestamp` (từ chối nếu lệch > 5 phút). Endpoint chỉ lắng nghe trên mạng nội bộ. Worker không có thông tin DB; *quyết định mở*: worker gọi callback trực tiếp, hay một "result relay" bên ngoài sandbox chuyển tiếp (đề xuất relay để sandbox không cần mạng — xem [APK_SECURITY_PIPELINE.md](APK_SECURITY_PIPELINE.md)).

## 9. Versioning

- Breaking change → `/api/v2`. Thêm trường tùy chọn không tính là breaking.
- Android Store gửi `X-Client-Version`; API có thể trả `426 Upgrade Required` cho bản Store quá cũ.
