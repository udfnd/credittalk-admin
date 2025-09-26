// src/app/api/admin/help-desk/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

async function isRequestFromAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
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

  // ✨ 핵심 변경: users 테이블에서 nickname을 함께 조회하도록 select문 수정
  const { data: question, error: questionError } = await supabaseAdmin
    .from('help_questions')
    .select('*, users(nickname)') // users 테이블의 nickname을 함께 가져옵니다.
    .eq('id', id)
    .single();

  if (questionError) {
    return new NextResponse(`Question not found: ${questionError.message}`, { status: 404 });
  }

  const { data: answer, error: answerError } = await supabaseAdmin
    .from('help_answers')
    .select('*')
    .eq('question_id', id)
    .single();

  if (answerError && answerError.code !== 'PGRST116') {
    console.warn(`Could not fetch answer: ${answerError.message}`);
  }

  return NextResponse.json({ question, answer: answer || null });
}
