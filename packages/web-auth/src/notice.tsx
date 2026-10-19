import { Alert } from '@novastore/ui';
import type { ApiResult } from './server';

/** Thông báo cho các trạng thái không phải `ok` / `anonymous` của ApiResult. */
export function ApiResultNotice({
  result,
}: {
  result: Exclude<ApiResult<unknown>, { kind: 'ok' }>;
}) {
  switch (result.kind) {
    case 'unconfigured':
      return (
        <Alert tone="warning" title="Chưa cấu hình Supabase">
          Sao chép <code>.env.local.example</code> thành <code>.env.local</code>, điền URL và
          publishable key của project Supabase rồi khởi động lại.
        </Alert>
      );
    case 'api_unreachable':
      return (
        <Alert tone="danger" title="Không kết nối được API">
          Kiểm tra <code>pnpm --filter @novastore/api dev</code> đang chạy và{' '}
          <code>NEXT_PUBLIC_API_URL</code> đúng địa chỉ.
        </Alert>
      );
    case 'anonymous':
      return <Alert tone="info" title="Bạn chưa đăng nhập" />;
    case 'error':
      if (result.problem?.code === 'MFA_REQUIRED') {
        return (
          <Alert tone="warning" title="Cần xác thực hai lớp (MFA)">
            Khu vực quản trị yêu cầu MFA. Bật TOTP cho tài khoản rồi đăng nhập lại.
          </Alert>
        );
      }
      if (result.problem?.code === 'ACCOUNT_SUSPENDED') {
        return <Alert tone="danger" title="Tài khoản đã bị khóa" />;
      }
      return (
        <Alert tone="danger" title={`Lỗi ${result.status}`}>
          {result.problem?.detail ?? result.problem?.title ?? 'Không rõ nguyên nhân'}
          {result.problem?.requestId ? ` · Request ID: ${result.problem.requestId}` : null}
        </Alert>
      );
  }
}
