// src/app/api/admin/statistics/login-logs/route.ts
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

export async function GET() {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 사용자의 auth.users 테이블에서 직접 최신 로그인 기록을 가져옵니다.
    // 이것이 가장 정확한 로그인 시간 정보입니다.
    const { data: authUsersResponse, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      sortBy: { field: 'last_sign_in_at', order: 'desc' },
      page: 1,
      perPage: 100, // 최근 100명의 로그인 기록을 가져옵니다.
    });

    if (authError) throw authError;

    // 이메일이 없는 등 비정상적인 사용자는 필터링합니다.
    const validUsers = authUsersResponse.users.filter(u => u.email && u.last_sign_in_at);
    const userIds = validUsers.map(u => u.id);

    if (userIds.length === 0) {
      return NextResponse.json([]);
    }

    // auth_user_id를 기반으로 public.users 테이블에서 프로필 정보(이름)를 가져옵니다.
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('users')
      .select('auth_user_id, name')
      .in('auth_user_id', userIds);

    if (profileError) throw profileError;

    // 프로필 정보를 빠르게 찾기 위해 Map으로 변환합니다.
    const profileMap = new Map(profiles.map(p => [p.auth_user_id, p.name]));

    // 최종적으로 로그인 로그 데이터를 조합합니다.
    const loginLogs = validUsers.map(user => ({
      name: profileMap.get(user.id) || 'N/A', // 프로필이 없을 경우 'N/A'
      email: user.email,
      login_at: user.last_sign_in_at,
    }));

    return NextResponse.json(loginLogs);

  } catch (err) {
    console.error('Login logs fetch error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
