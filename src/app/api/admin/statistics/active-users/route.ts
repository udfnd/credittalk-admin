// src/app/api/admin/statistics/active-users/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

// GET: 현재 접속자 목록 조회 (user_login_logs 기반)
export async function GET() {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 최근 30분 이내에 로그인한 기록을 조회합니다.
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('user_login_logs')
      .select('user_name, user_email, login_at')
      .gte('login_at', thirtyMinutesAgo)
      .order('login_at', { ascending: false });

    if (error) throw error;

    // 동일 사용자가 여러 번 로그인했을 경우, 가장 최신 기록만 남깁니다.
    const uniqueUsers = Array.from(new Map(data.map(log => [log.user_email, log])).values());

    return NextResponse.json(uniqueUsers);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
