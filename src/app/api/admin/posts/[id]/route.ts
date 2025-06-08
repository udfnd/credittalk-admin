// src/app/api/admin/posts/[id]/route.ts
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
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

// 단일 게시글 조회
export async function GET(
  _request: NextRequest, // 사용되지 않으므로 '_' 접두사 추가
  { params }: { params: { id: string } }
) {
  if (!await isRequestFromAdmin()) { // request 인자 없이 호출
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('community_posts')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) {
    return new NextResponse(error.message, { status: 404 });
  }

  return NextResponse.json(data);
}

// 게시글 수정
export async function PUT(
  request: NextRequest, // request.json()을 사용하므로 이름 유지
  { params }: { params: { id: string } }
) {
  if (!await isRequestFromAdmin()) { // request 인자 없이 호출
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const body = await request.json();
  const { error } = await supabaseAdmin
    .from('community_posts')
    .update({
      title: body.title,
      content: body.content,
      category: body.category,
    })
    .eq('id', params.id);

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}

// 게시글 삭제
export async function DELETE(
  _request: NextRequest, // 사용되지 않으므로 '_' 접두사 추가
  { params }: { params: { id: string } }
) {
  if (!await isRequestFromAdmin()) { // request 인자 없이 호출
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from('community_posts')
    .delete()
    .eq('id', params.id);

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
