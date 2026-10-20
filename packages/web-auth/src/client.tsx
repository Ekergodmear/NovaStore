'use client';

import { Alert, Button, Card, Input, Label } from '@novastore/ui';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { getPublicConfig } from './config';
import { safeNext } from './safe-next';

function createSupabaseBrowserClient() {
  const config = getPublicConfig();
  return config ? createBrowserClient(config.supabaseUrl, config.supabaseKey) : null;
}

export function LoginForm({ next = '/', heading }: { next?: string; heading: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return (
      <Alert tone="warning" title="Chưa cấu hình Supabase">
        Đặt <code>NEXT_PUBLIC_SUPABASE_URL</code> và{' '}
        <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> trong <code>.env.local</code> của app này
        rồi khởi động lại.
      </Alert>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    setPending(true);
    setError(null);
    setInfo(null);

    const result =
      mode === 'sign-in'
        ? await supabase!.auth.signInWithPassword({ email, password })
        : await supabase!.auth.signUp({ email, password });
    setPending(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (mode === 'sign-up' && !result.data.session) {
      setInfo('Đã gửi email xác nhận. Mở link trong email rồi đăng nhập.');
      return;
    }
    router.replace(safeNext(next));
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-[22px] leading-7 font-semibold">{heading}</h1>
      <p className="mt-1 text-sm text-fg-muted">
        {mode === 'sign-in' ? 'Đăng nhập bằng email và mật khẩu.' : 'Tạo tài khoản NovaStore mới.'}
      </p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Mật khẩu</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            minLength={8}
            required
          />
        </div>
        {error ? (
          <Alert tone="danger" title="Không thành công">
            {error}
          </Alert>
        ) : null}
        {info ? (
          <Alert tone="info" title="Kiểm tra email">
            {info}
          </Alert>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Đang xử lý…' : mode === 'sign-in' ? 'Đăng nhập' : 'Đăng ký'}
        </Button>
      </form>
      <button
        type="button"
        className="mt-4 text-sm text-primary hover:underline"
        onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
      >
        {mode === 'sign-in' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
      </button>
    </Card>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await createSupabaseBrowserClient()?.auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
    >
      Đăng xuất
    </Button>
  );
}
