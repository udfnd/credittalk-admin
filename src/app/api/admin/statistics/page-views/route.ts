// src/app/api/admin/statistics/page-views/route.ts
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

// GET: 페이지뷰 통계 조회
export async function GET() {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('page_views')
      .select('page_path')
      .limit(10000); // 성능을 위해 최근 데이터만 조회, 필요 시 조절

    if (error) throw error;

    const viewCounts = data.reduce((acc, view) => {
      acc[view.page_path] = (acc[view.page_path] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const result = Object.entries(viewCounts)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
