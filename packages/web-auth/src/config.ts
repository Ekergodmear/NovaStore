export interface PublicConfig {
  supabaseUrl: string;
  supabaseKey: string;
  apiUrl: string;
}

/**
 * Cấu hình public dùng ở cả server và browser.
 * Phải tham chiếu `process.env.NEXT_PUBLIC_*` trực tiếp để Next.js inline giá trị vào bundle.
 * Trả null khi chưa cấu hình Supabase để UI hiện hướng dẫn thay vì lỗi.
 */
export function getPublicConfig(): PublicConfig | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  if (!supabaseUrl || !supabaseKey) return null;
  return { supabaseUrl, supabaseKey, apiUrl: apiUrl.replace(/\/+$/, '') };
}
