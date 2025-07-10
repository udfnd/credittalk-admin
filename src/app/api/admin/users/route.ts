// src/app/api/admin/users/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

// 관리자인지 확인하는 헬퍼 함수
async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: isAdmin, error } = await supabase.rpc('is_current_user_admin');
  if (error) {
    console.error('Admin check rpc error in users API:', error);
    return false;
  }
  return isAdmin === true;
}

// 모든 사용자 목록 조회 (검색 기능 추가)
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');

  try {
    let query = supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    // 검색어가 있는 경우, or 조건을 사용하여 이름 또는 닉네임(name) 필드 검색
    if (search) {
      query = query.or(`name.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
