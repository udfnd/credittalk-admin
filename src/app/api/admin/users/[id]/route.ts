// src/app/api/admin/users/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

// 관리자인지 확인하는 헬퍼 함수 (request 파라미터 제거)
async function isRequestFromAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return false;

  const { data: isAdmin, error } = await supabase.rpc('is_current_user_admin');
  if (error) {
    console.error('Admin check rpc error:', error);
    return false;
  }
  return isAdmin === true;
}

export async function DELETE(
  _request: NextRequest, // 사용되지 않으므로 '_' 접두사 추가
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userAuthId = id;

  if (!await isRequestFromAdmin()) { // request 인자 없이 호출
    return new NextResponse('Unauthorized', { status: 401 });
  }

  if (!userAuthId) {
    return new NextResponse('User ID is required', { status: 400 });
  }

  try {
    // Supabase Auth에서 사용자 삭제
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userAuthId);

    if (authError) {
      console.error('Supabase Auth Delete Error:', authError);
      return new NextResponse(`Authentication service error: ${authError.message}`, { status: 500 });
    }

    // public.users 테이블에서 사용자 프로필 삭제
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('auth_user_id', userAuthId);

    if (dbError) {
      console.error('Supabase DB Delete Error:', dbError);
      return new NextResponse(`Database error: ${dbError.message}`, { status: 500 });
    }

    return new NextResponse(null, { status: 204 }); // No Content
  } catch (err) {
    console.error('User Deletion Error:', err);
    let errorMessage = 'An unknown error occurred';
    if (err instanceof Error) errorMessage = err.message;
    return new NextResponse(`Internal Server Error: ${errorMessage}`, { status: 500 });
  }
}
