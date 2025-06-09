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

  // 질문 조회
  const { data: question, error: questionError } = await supabaseAdmin
    .from('help_questions_with_author') // 위에서 생성한 뷰 사용
    .select('*')
    .eq('id', id)
    .single();

  if (questionError) {
    return new NextResponse(`Question not found: ${questionError.message}`, { status: 404 });
  }

  // 답변 조회 (없을 수도 있음)
  const { data: answer, error: answerError } = await supabaseAdmin
    .from('help_answers')
    .select('*')
    .eq('question_id', id)
    .single();

  // 답변 조회 시 에러가 발생해도 괜찮음 (답변이 아직 없는 경우)
  if (answerError && answerError.code !== 'PGRST116') { // PGRST116: a single item was requested, but zero rows were returned
    console.warn(`Could not fetch answer: ${answerError.message}`);
  }

  return NextResponse.json({ question, answer: answer || null });
}
