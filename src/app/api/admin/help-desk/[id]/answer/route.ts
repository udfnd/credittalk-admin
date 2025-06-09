// src/app/api/admin/help-desk/[id]/answer/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const questionId = Number(id);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 관리자 여부 확인
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const { content } = await request.json();
    if (!content) {
      return new NextResponse('Answer content is required', { status: 400 });
    }

    // 1. help_answers 테이블에 답변 저장
    const { error: answerError } = await supabaseAdmin
      .from('help_answers')
      .insert({
        question_id: questionId,
        admin_id: user.id, // 답변한 관리자(현재 로그인한 유저)의 ID
        content: content,
      });

    if (answerError) {
      // 이미 답변이 있는 경우(unique 제약 조건 위반) 업데이트로 처리
      if (answerError.code === '23505') { // unique_violation
        const { error: updateError } = await supabaseAdmin
          .from('help_answers')
          .update({ content: content, admin_id: user.id })
          .eq('question_id', questionId);
        if (updateError) throw updateError;
      } else {
        throw answerError;
      }
    }

    // 2. help_questions 테이블의 상태를 '답변 완료'로 변경
    const { error: questionUpdateError } = await supabaseAdmin
      .from('help_questions')
      .update({ is_answered: true })
      .eq('id', questionId);

    if (questionUpdateError) throw questionUpdateError;

    return NextResponse.json({ message: 'Answer submitted successfully' });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
