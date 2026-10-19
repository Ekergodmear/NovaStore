# NovaStore — UI Design System

> Draft v0.1 · 2026-10-19 · Lấy cảm hứng từ Google Play về bố cục, **không** sao chép logo, icon, màu thương hiệu hay asset của Google.

## 1. Nguyên tắc

1. **Nội dung là trung tâm**: icon app lớn, screenshot đẹp; UI nhường chỗ.
2. **Thoáng, ít viền**: tách khối bằng khoảng trắng và nền, không bằng border.
3. **Minh bạch an toàn**: quyền truy cập, chữ ký, SHA-256, trạng thái duyệt luôn dễ thấy — đây là điểm khác biệt.
4. **Một hệ token, nhiều nền tảng**: cùng token cho Tailwind (web) và Compose (Android).

## 2. Design tokens

### Màu
| Token | Light | Dark | Dùng cho |
|-------|-------|------|---------|
| `primary` | emerald-600 `#059669` | emerald-400 `#34D399` | CTA "Cài đặt", link, focus |
| `primary-fg` | `#FFFFFF` | `#022C22` | chữ trên primary |
| `primary-soft` | emerald-50 `#ECFDF5` | `#064E3B` | chip, badge "Đã xác minh" |
| `bg` | trắng ngà `#FAFAF7` | `#0B0F0E` | nền trang |
| `surface` | `#FFFFFF` | `#141A18` | card |
| `surface-muted` | `#F1F2EE` | `#1C2421` | nền khối phụ |
| `fg` | slate-900 `#0F172A` | slate-100 `#F1F5F9` | chữ chính |
| `fg-muted` | slate-500 `#64748B` | slate-400 `#94A3B8` | chữ phụ |
| `border` | `#E5E7E1` | `#26302C` | chỉ khi thật cần |
| `warning` | amber-600 `#D97706` | amber-400 | quyền nhạy cảm, scan warn |
| `danger` | rose-600 `#E11D48` | rose-400 | reject, revoke, malware |
| `info` | sky-600 `#0284C7` | sky-400 | trạng thái processing |

Tương phản: chữ thường ≥ 4.5:1, chữ lớn/icon ≥ 3:1 (WCAG AA). Kiểm `primary` trên `bg` trước khi chốt.

### Typography
- Font: **Be Vietnam Pro** (hỗ trợ tiếng Việt tốt) cho web; Android dùng cùng font qua `res/font`, fallback Roboto.
- Mono (SHA-256, package name): JetBrains Mono.

| Token | Size/Line | Weight |
|-------|-----------|--------|
| `display` | 32/40 | 700 |
| `title-lg` | 22/28 | 600 |
| `title` | 18/24 | 600 |
| `body` | 15/22 | 400 |
| `body-sm` | 13/18 | 400 |
| `label` | 13/16 | 500 |

### Khoảng cách, bo góc, đổ bóng
- Spacing scale 4px: 4, 8, 12, 16, 24, 32, 48, 64.
- Radius: `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 · icon app 22% (squircle) · pill 999.
- Elevation: chỉ 2 mức — `card` (`0 1px 2px rgb(0 0 0 / .05)`), `overlay` (dialog/sheet).
- Grid web: container 1200px, 12 cột, gutter 24; mobile gutter 16.

## 3. Component chính (`packages/ui`, dựa trên shadcn/ui)

| Component | Ghi chú |
|-----------|--------|
| `AppIcon` | sizes 40/56/72/96; placeholder chữ cái đầu |
| `AppCard` | biến thể `compact` (list), `tile` (grid), `feature` (banner có feature graphic) |
| `RatingStars`, `RatingSummary` | histogram 5→1 sao |
| `InstallButton` | trạng thái: Cài đặt → Đang tải x% → Cài → Mở / Cập nhật; web: "Tải APK" |
| `PermissionList` | nhóm quyền, quyền nhạy cảm có icon `warning` + giải thích tiếng Việt |
| `TrustPanel` | developer đã xác minh, SHA-256 (copy), chứng chỉ ký, ngày duyệt |
| `ScreenshotCarousel` | scroll ngang, lightbox |
| `StatusBadge` | màu theo `release_status` |
| `Stepper` | wizard 5 bước Developer Console |
| `FileDropzone` | upload APK: progress, hủy, retry; hiển thị kết quả trích xuất |
| `DataTable` | Admin/Dev: sort, filter, phân trang cursor |
| `KpiCard`, `LineChart` | dashboard (Recharts) |
| `EmptyState`, `Skeleton`, `Toast`, `ConfirmDialog` | ConfirmDialog bắt buộc gõ tên app cho thao tác remove/revoke |

## 4. Màn hình

### 4.1 Android Store (Compose, Material 3 với token riêng)
Bottom navigation: **Khám phá · Danh mục · Tìm kiếm · Cá nhân**.

| Màn hình | Nội dung |
|----------|---------|
| Khám phá | Banner featured (carousel), hàng "Mới", "Phổ biến", theo danh mục |
| Danh mục | Grid danh mục → danh sách app |
| Tìm kiếm | Gợi ý khi gõ, lịch sử, kết quả với filter danh mục |
| Chi tiết app | Header (icon, tên, developer, rating, downloads, size) · InstallButton · screenshots · mô tả · "Có gì mới" · PermissionList · TrustPanel · Reviews · Báo cáo |
| Cá nhân | Đăng nhập, **Quản lý app** (đã cài từ NovaStore, có cập nhật, bị thu hồi), lịch sử, cài đặt |
| Onboarding cài đặt | Hướng dẫn bật "Install unknown apps" cho NovaStore, có ảnh minh họa theo hãng phổ biến |

### 4.2 Web Marketplace
Header: logo, ô tìm kiếm, Danh mục, Đăng nhập, "Dành cho nhà phát triển". Trang: Home, Category, Search, App detail (`/app/{slug}`), Developer (`/dev/{slug}`). Trang chi tiết có nút "Tải APK" + "Mở trong NovaStore" (deep link) + mã QR. SEO: SSR/ISR, JSON-LD `SoftwareApplication`, OG image.

### 4.3 Developer Console
Sidebar: **Tổng quan · Ứng dụng của tôi · Tạo ứng dụng · Phiên bản · Đánh giá · Thống kê · Tài khoản**.

Wizard tạo app 5 bước:
1. **Thông tin cơ bản** — tên, mô tả ngắn/đầy đủ, danh mục, ngôn ngữ.
2. **Media** — icon 512×512, feature graphic 1024×500, 2–8 screenshot.
3. **Phân loại & chính sách** — content rating, có quảng cáo, privacy policy URL, liên hệ.
4. **Upload APK** — dropzone; sau khi xử lý hiện package name, version, quyền, chữ ký; cảnh báo quyền nhạy cảm.
5. **Xem lại & gửi duyệt** — preview trang Store, checklist, nút "Gửi duyệt".

Lưu nháp tự động mỗi bước. Trang release hiển thị timeline trạng thái và lý do từ chối kèm hướng dẫn sửa.

### 4.4 Admin Console
- Dashboard KPI: chờ duyệt, phiên bản mới gửi (24h), app bị report, developer hoạt động (30 ngày), tỉ lệ duyệt, sự kiện bảo mật gần đây.
- **Review workspace** (màn hình chính của moderator), bố cục 3 cột:
  - Trái: hàng đợi (risk score, thời gian chờ).
  - Giữa: preview listing + screenshots + diff với bản trước.
  - Phải: artifact (SHA-256, chứng chỉ, khớp lineage ✓/✗), permissions, scan findings, checklist, nút **Phê duyệt / Từ chối** (lý do bắt buộc).
- Phím tắt: `J/K` chuyển item, `A` approve (vẫn cần xác nhận), `R` reject.

## 5. Trạng thái & copywriting

| Trạng thái release | Nhãn | Màu |
|-------------------|------|-----|
| draft | Bản nháp | muted |
| processing | Đang kiểm tra | info |
| pending_review | Chờ duyệt | warning |
| rejected | Bị từ chối | danger |
| published | Đã phát hành | primary |
| superseded | Bản cũ | muted |
| revoked | Đã thu hồi | danger |

Giọng văn: ngắn gọn, xưng "bạn", giải thích **vì sao** và **làm gì tiếp** cho mọi lỗi (vd. "Chữ ký không khớp với phiên bản trước. Hãy ký APK bằng cùng keystore đã dùng cho bản 2.0.0.").

## 6. Khả năng tiếp cận
Focus ring rõ (`primary` 2px), target chạm ≥ 48dp, hỗ trợ TalkBack/screen reader cho rating và InstallButton, không dùng màu là tín hiệu duy nhất, tôn trọng `prefers-reduced-motion`, dark mode cả web và Android.

## 7. Quyết định mở
- Tên & logo thương hiệu chính thức.
- Có dùng Material You dynamic color trên Android 12+ hay giữ màu emerald cố định (đề xuất: cố định để nhận diện thương hiệu).
