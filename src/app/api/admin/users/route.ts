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

// 모든 사용자 목록 조회 (검색 및 소스 조회 기능 추가)
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const getSource = searchParams.get('source');

  try {
    if (getSource) {
      // 가입 경로 데이터 요청
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, name, auth_user_id, sign_up_source, created_at')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      // auth.users 테이블에서 이메일 정보를 가져와 합칩니다.
      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000, // 필요시 페이지네이션 구현
      });
      if(authError) throw new Error(authError.message);

      const emailMap = new Map(authUsers.users.map(u => [u.id, u.email]));
      const result = data.map(u => ({ ...u, email: emailMap.get(u.auth_user_id) || '' }));

      return NextResponse.json(result);
    }

    // 기존 사용자 목록 조회 로직
    let query = supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,nickname.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
