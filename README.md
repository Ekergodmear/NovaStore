# NovaStore

Nền tảng phân phối ứng dụng Android độc lập: Web Marketplace, Developer Console, Admin Console, Android Store, dùng chung một backend NestJS.

Tài liệu thiết kế nằm trong [docs/](docs/). Bắt đầu từ [PRD](docs/PRD.md) và [ARCHITECTURE](docs/ARCHITECTURE.md).

## Trạng thái

**Phase 1 (Foundation)**: monorepo, schema DB, xác thực Supabase, RBAC, audit log, design system, CI.

**Phase 2A (backend)**: đăng ký developer account, vòng đời trạng thái do staff duyệt, phân quyền theo quyền sở hữu, OpenAPI tại `/api/docs`.

**Phase 2B (backend)**: tạo và quản lý app nháp, vòng đời app, archive, Admin quản lý danh mục. Xem [MVP_ROADMAP](docs/MVP_ROADMAP.md).

## Cấu trúc

| Thư mục                 | Nội dung                                         | Cổng dev |
| ----------------------- | ------------------------------------------------ | -------- |
| `apps/web`              | Web Marketplace (Next.js)                        | 3000     |
| `apps/developer`        | Developer Console (Next.js)                      | 3001     |
| `apps/admin`            | Admin Console (Next.js)                          | 3002     |
| `apps/api`              | Backend NestJS: `/api/v1`, `/healthz`, `/readyz` | 4000     |
| `apps/worker`           | BullMQ worker xử lý APK (khung, Phase 3)         | —        |
| `packages/database`     | Prisma schema, migration, seed                   | —        |
| `packages/types`        | Kiểu dùng chung                                  | —        |
| `packages/validation`   | Zod schema dùng chung                            | —        |
| `packages/ui`           | Design tokens + component (Tailwind v4)          | —        |
| `packages/web-auth`     | Supabase SSR auth + gọi API cho 3 app Next.js    | —        |
| `packages/config`       | tsconfig dùng chung                              | —        |
| `infrastructure/docker` | Postgres, Redis, S3 giả lập R2 (SeaweedFS)       | —        |

## Yêu cầu

- Node.js ≥ 22.12, pnpm 11
- Docker Desktop (cho Postgres/Redis/S3 local)
- Một project Supabase (Auth)

## Chạy local

```bash
pnpm install
pnpm infra:up
```

Tạo file môi trường từ các mẫu:

- `packages/database/.env` ← `packages/database/.env.example`
- `apps/api/.env` ← `apps/api/.env.example`: điền `SUPABASE_URL`
- `apps/{web,developer,admin}/.env.local` ← `.env.local.example`: điền URL + publishable key Supabase

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

### Cấp quyền Admin/Moderator

User phải đăng nhập vào một console ít nhất một lần (để có bản ghi trong `users`), sau đó:

```bash
pnpm db:grant-role you@example.com admin
```

Ở môi trường dev, `REQUIRE_STAFF_MFA=false` cho phép vào Admin Console mà chưa bật MFA. Production mặc định bắt buộc MFA (`aal2`).

## Kiểm tra

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Nguyên tắc bảo mật chính

- Mọi route API **mặc định yêu cầu đăng nhập**; route công khai phải gắn `@Public()`.
- Phân quyền lấy từ Postgres (`user_roles`, `developer_members`), không tin claim tùy biến trong JWT.
- Thay đổi trạng thái ghi `audit_logs` trong cùng transaction; bảng này có trigger chặn UPDATE/DELETE.
- `release_artifacts` bất biến ở tầng DB (chỉ được gán `public_key` một lần khi publish).
- APK không bao giờ được phân tích trong tiến trình API. Xem [APK_SECURITY_PIPELINE](docs/APK_SECURITY_PIPELINE.md).
