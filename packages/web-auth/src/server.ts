import 'server-only';
import type { MeResponse, ProblemDetails } from '@novastore/types';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { getPublicConfig } from './config';

export async function createSupabaseServerClient() {
  const config = getPublicConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.supabaseUrl, config.supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component không ghi được cookie; middleware đã lo việc refresh.
        }
      },
    },
  });
}

export type ApiResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'unconfigured' }
  | { kind: 'anonymous' }
  | { kind: 'api_unreachable' }
  | { kind: 'error'; status: number; problem: ProblemDetails | null };

/** Gọi NovaStore API bằng access token của session hiện tại (API tự xác minh token). */
export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  const config = getPublicConfig();
  const supabase = await createSupabaseServerClient();
  if (!config || !supabase) return { kind: 'unconfigured' };

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { kind: 'anonymous' };

  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}/api/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    return { kind: 'api_unreachable' };
  }

  if (response.ok) return { kind: 'ok', data: (await response.json()) as T };
  if (response.status === 401) return { kind: 'anonymous' };
  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
  return { kind: 'error', status: response.status, problem };
}

/** Dedupe trong một request: layout và page cùng gọi chỉ tốn một lần gọi API. */
export const fetchMe = cache((): Promise<ApiResult<MeResponse>> => apiGet<MeResponse>('/me'));
