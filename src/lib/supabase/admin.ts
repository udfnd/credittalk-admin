import { createClient } from '@supabase/supabase-js';

// 주의: 이 클라이언트는 service_role 키를 사용하므로,
// 절대 클라이언트 측 코드에서 사용하거나 노출해서는 안 됩니다.
// 오직 서버 사이드 (API Routes, Edge Functions)에서만 사용해야 합니다.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
