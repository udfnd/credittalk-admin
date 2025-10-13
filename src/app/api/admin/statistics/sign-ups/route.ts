// src/app/api/admin/statistics/sign-ups/route.ts
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
    const allUsers: { created_at: string }[] = [];
    const PAGE_SIZE = 1000;
    let page = 0;

    // FIX: Supabase의 1,000개 조회 제한을 해결하기 위해 페이지네이션으로 모든 데이터를 가져옵니다.
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('created_at')
        .order('created_at', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      if (data) {
        allUsers.push(...data);
      }

      // 가져온 데이터가 페이지 크기보다 작으면 마지막 페이지이므로 루프를 중단합니다.
      if (!data || data.length < PAGE_SIZE) {
        break;
      }

      page++;
    }

    const dailySignUps = allUsers.reduce((acc, user) => {
      // created_at 값이 유효한 경우에만 집계합니다.
      if (user.created_at) {
        const date = new Date(user.created_at).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const result = Object.entries(dailySignUps)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
