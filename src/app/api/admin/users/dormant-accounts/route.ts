// src/app/api/admin/users/dormant-accounts/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

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
    // 6개월 전 날짜 계산
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // 6개월 이상 로그인하지 않았거나, 마지막 로그인 기록이 없는 사용자 조회
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, auth_user_id, name, last_login_at, is_dormant')
      .or(`last_login_at.lte.${sixMonthsAgo.toISOString()},last_login_at.is.null`)
      .order('last_login_at', { ascending: true, nullsFirst: true });

    if (error) throw new Error(error.message);

    // auth.users 테이블에서 이메일 정보를 가져와 합칩니다.
    const userIds = data.map(u => u.auth_user_id);
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if(authError) throw new Error(authError.message);

    const emailMap = new Map(authUsers.users.map(u => [u.id, u.email]));
    const result = data.map(u => ({ ...u, email: emailMap.get(u.auth_user_id) || '' }));

    return NextResponse.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { userId, is_dormant } = await request.json();
    if (!userId) {
      return new NextResponse('User ID is required', { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({ is_dormant: is_dormant })
      .eq('auth_user_id', userId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ message: 'User status updated successfully.' });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
