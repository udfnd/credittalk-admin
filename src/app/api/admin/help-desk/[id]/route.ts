// src/app/api/admin/help-desk/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

// 관리자 요청인지 확인하는 함수 (수정 없음)
async function isRequestFromAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  // is_current_user_admin 함수는 현재 사용자가 관리자인지 boolean 값을 반환합니다.
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!await isRequestFromAdmin()) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { data: question, error: questionError } = await supabaseAdmin
    .from('help_questions')
    .select('*, users(name, nickname)')
    .eq('id', id)
    .maybeSingle();

  if (questionError) {
    return new NextResponse(`Database error: ${questionError.message}`, { status: 500 });
  }

  if (!question) {
    return new NextResponse(`Question with id ${id} not found`, { status: 404 });
  }

  const { data: comments, error: commentsError } = await supabaseAdmin
    .from('help_desk_comments')
    .select('*, users!inner(is_admin, name, nickname)')
    .eq('question_id', id)
    .order('created_at', { ascending: true });

  if (commentsError) {
    console.error(`Could not fetch comments: ${commentsError.message}`);
    return new NextResponse(`Database error: ${commentsError.message}`, { status: 500 });
  }

  // 프론트엔드와 동일한 { question, comments } 구조로 데이터 반환
  return NextResponse.json({ question, comments: comments || [] });
}
