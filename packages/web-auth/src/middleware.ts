import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicConfig } from './config';

/** Làm mới session Supabase trong cookie ở mỗi request (pattern chuẩn của @supabase/ssr). */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const config = getPublicConfig();
  let response = NextResponse.next({ request });
  if (!config) return response;

  const supabase = createServerClient(config.supabaseUrl, config.supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() xác minh token với Supabase và kích hoạt refresh khi cần.
  await supabase.auth.getUser();
  return response;
}
