# NovaStore — Product Requirements Document (PRD)

> Trạng thái: **Draft v0.1** · Ngày: 2026-10-19 · Tên "NovaStore" là placeholder.

## 1. Tầm nhìn

NovaStore là nền tảng phân phối ứng dụng Android độc lập. Nhà phát triển đăng tải APK, quản lý phiên bản; người dùng khám phá, tải, cài đặt, cập nhật và đánh giá ứng dụng. Mục tiêu là một sản phẩm **vận hành được thật**, có quy trình kiểm duyệt an toàn — không phải bản clone giao diện Google Play.

## 2. Mục tiêu MVP

| # | Mục tiêu | Đo lường |
|---|----------|----------|
| G1 | Developer tự phục vụ: đăng ký → tạo app → upload APK → gửi duyệt | ≤ 15 phút cho app đầu tiên |
| G2 | Không APK nào public khi chưa qua validation + scan + moderation | 0 vi phạm (kiểm bằng test + audit log) |
| G3 | Người dùng tải & cài APK từ Web và Android Store | Luồng E2E pass trên Android 10–15 |
| G4 | Cập nhật an toàn: cùng package name + chữ ký hợp lệ | 100% bản update sai chữ ký bị chặn |
| G5 | Gỡ / thu hồi nhanh | Admin gỡ app hoặc revoke release ≤ 5 phút có hiệu lực |

### Ngoài phạm vi MVP (non-goals)
Thanh toán, IAP, subscription, quảng cáo, chia sẻ doanh thu, AI recommendation, A/B testing, public developer API, phân phối AAB, auto-update ngầm, iOS. Chi tiết: [MVP_ROADMAP.md](MVP_ROADMAP.md#post-mvp).

## 3. Persona & vai trò

| Vai trò | Mô tả | Quyền chính |
|---------|-------|-------------|
| Guest | Khách chưa đăng nhập | Xem, tìm kiếm, tải app công khai |
| User | Đã đăng nhập | + đánh giá, báo cáo, lưu app, lịch sử tải |
| Developer | User đã tạo & được xác minh developer account | + tạo app, upload release, xem thống kê app của mình |
| Moderator | Nhân sự kiểm duyệt | + hàng đợi kiểm duyệt, approve/reject, xử lý report |
| Admin | Vận hành nền tảng | + quản lý user/developer, khóa tài khoản, gỡ app, revoke release, cấu hình |

Một người có thể giữ nhiều vai trò (User + Developer). Moderator/Admin **không được** duyệt app thuộc developer account mà chính họ là thành viên (conflict-of-interest).

## 4. Sản phẩm thành phần

1. **Web Marketplace** (`apps/web`) — khám phá, tìm kiếm, chi tiết app, tải APK, đánh giá.
2. **Developer Console** (`apps/developer`) — quản lý app, wizard tạo app 5 bước, release, review, thống kê.
3. **Admin Console** (`apps/admin`) — moderation queue, báo cáo, quản lý developer, audit log.
4. **Backend API** (`apps/api`) — NestJS modular monolith.
5. **APK Worker** (`apps/worker`) — inspection & scanning trong môi trường cô lập.
6. **Android Store** (`apps/android`) — Kotlin + Compose, cài đặt qua `PackageInstaller`.

## 5. User stories MVP

### Developer
- D1. Tôi đăng ký developer account với tên hiển thị, email liên hệ, website (tùy chọn) và đồng ý Developer Agreement.
- D2. Tôi tạo app qua wizard 5 bước: (1) Thông tin cơ bản → (2) Media → (3) Phân loại & nội dung → (4) Upload APK → (5) Xem lại & gửi duyệt.
- D3. Package name được **khóa** vào app sau release đầu tiên được duyệt; không ai khác đăng được cùng package name.
- D4. Tôi upload APK mới; hệ thống tự trích xuất versionCode, versionName, minSdk, targetSdk, permissions, chứng chỉ ký.
- D5. Tôi thấy trạng thái release: `draft → uploading → processing → pending_review → approved/rejected → published`, kèm lý do từ chối.
- D6. Tôi xem lượt tải theo ngày và đánh giá; có thể trả lời đánh giá.

### Moderator / Admin
- M1. Tôi xem hàng đợi kiểm duyệt sắp theo thời gian chờ và mức rủi ro scan.
- M2. Khi mở một release, tôi thấy: metadata APK, SHA-256, chứng chỉ ký (và có khớp release trước không), permissions (đánh dấu quyền nhạy cảm), kết quả scan, lịch sử phiên bản, diff metadata.
- M3. Tôi approve hoặc reject với lý do bắt buộc (chọn từ danh mục + ghi chú).
- M4. Tôi xử lý report: bỏ qua, yêu cầu developer sửa, gỡ app, revoke release.
- A1. Admin khóa developer account → toàn bộ app của họ bị ẩn khỏi Store.
- A2. Admin revoke một release nguy hiểm → client được báo qua endpoint updates.

### User
- U1. Tôi duyệt trang chủ (featured, mới, phổ biến theo danh mục), tìm kiếm theo tên/developer/từ khóa.
- U2. Trang chi tiết hiển thị screenshot, mô tả, quyền truy cập, kích thước, phiên bản, SHA-256, đánh giá.
- U3. Trên Android Store, tôi tải & cài app; được hướng dẫn bật "Install unknown apps" cho NovaStore.
- U4. Tôi thấy danh sách app đã cài từ NovaStore có bản cập nhật và cập nhật thủ công.
- U5. Tôi đánh giá 1–5 sao + bình luận (1 review/app/user, sửa được) và báo cáo vi phạm.

## 6. Yêu cầu phi chức năng

| Hạng mục | Yêu cầu MVP |
|----------|-------------|
| Bảo mật | RBAC trên mọi endpoint ghi; audit log; APK quarantine; signed URL ngắn hạn; xem [APK_SECURITY_PIPELINE.md](APK_SECURITY_PIPELINE.md) |
| Hiệu năng | API p95 < 300 ms (đọc catalog); trang web LCP < 2.5 s trên 4G |
| Dung lượng APK | Tối đa 200 MB/APK (cấu hình được) |
| Khả dụng | Beta: 99% / tháng, backup DB hằng ngày, RPO 24h, RTO 4h |
| Quan sát | Sentry + structured JSON log + request ID xuyên suốt API ↔ worker |
| Ngôn ngữ | UI tiếng Việt mặc định, cấu trúc i18n sẵn cho tiếng Anh |
| Riêng tư | Thu thập tối thiểu; không lưu IP thô quá 30 ngày; xem mục 8 |

## 7. Chỉ số thành công beta

- ≥ 30 developer thật, ≥ 100 app được duyệt.
- Thời gian duyệt trung vị < 48h.
- Tỉ lệ cài thành công trên Android Store ≥ 95% (trừ hủy bởi người dùng).
- 0 sự cố malware đã phát hành mà không được gỡ trong 24h kể từ khi phát hiện.

## 8. Rủi ro, giả định & quyết định còn mở

### Giả định
- A1. Chỉ app miễn phí, chỉ APK đơn (không split APK / AAB) ở MVP.
- A2. Developer tự ký APK; NovaStore **không** ký lại.
- A3. Nhân sự kiểm duyệt ban đầu là 1–2 người; khối lượng ≤ 50 release/tuần.
- A4. Android Store được phân phối dạng sideload (tải APK từ website), không qua Google Play.

### Rủi ro chính
| Rủi ro | Mức | Giảm thiểu |
|--------|-----|-----------|
| Phát tán malware | Cao | Pipeline nhiều lớp + manual review + report + revoke |
| Mạo danh app nổi tiếng (package/tên/icon) | Cao | Blocklist package name phổ biến, kiểm tra tên tương tự, xác minh quyền sở hữu |
| Google Play Protect cảnh báo Store/app | Trung bình | Tuân thủ target SDK hiện hành, không xin quyền thừa, minh bạch |
| Chi phí kiểm duyệt thủ công | Trung bình | Ưu tiên theo risk score, checklist chuẩn |
| Pháp lý (SHTT, dữ liệu cá nhân, gỡ nội dung) | Cao | Rà soát pháp lý trước public beta |
| Lạm dụng review/download | Trung bình | Rate limit, dedup download, 1 review/user/app |

### Quyết định còn mở (cần chủ dự án chốt)
1. **Auth**: Supabase Auth hay tự xây (NestJS + Argon2 + JWT)? Đề xuất: Supabase Auth cho MVP, RBAC lưu trong Postgres riêng.
2. **Xác minh developer**: chỉ email, hay thêm giấy tờ/số điện thoại? Ảnh hưởng chống lạm dụng và pháp lý.
3. **Xác minh quyền sở hữu package name** trùng app đã có trên Google Play (vd. yêu cầu file trên website/ký thử thách)?
4. **Dịch vụ scan bên thứ ba** (VirusTotal…) — điều khoản dùng thương mại & chi phí.
5. **Hosting**: Fly.io / Railway / VPS? Worker cần hỗ trợ container cô lập.
6. **Pháp lý VN**: nghĩa vụ đăng ký/thông báo với cơ quan quản lý, chính sách gỡ nội dung, xử lý dữ liệu cá nhân — cần tư vấn luật sư.
7. **Tên thương hiệu & domain**.
