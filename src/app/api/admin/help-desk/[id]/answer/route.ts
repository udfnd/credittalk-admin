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

  // 관리자 여부 확인 (기존과 동일)
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const { content } = await request.json();
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return new NextResponse('Answer content is required', { status: 400 });
    }

    // --- 스키마에 맞게 답변 저장 로직 전체 수정 ---

    // 1. 현재 관리자가 이 질문에 이미 작성한 댓글(답변)이 있는지 확인합니다.
    const { data: existingComment, error: findError } = await supabaseAdmin
      .from('help_desk_comments')
      .select('id')
      .eq('question_id', questionId)
      .eq('user_id', user.id) // 현재 로그인한 관리자 ID로 조회
      .maybeSingle();

    if (findError) {
      throw new Error(`Error finding existing comment: ${findError.message}`);
    }

    // 2. 확인 결과에 따라 'UPDATE' 또는 'INSERT'를 수행합니다.
    if (existingComment) {
      // 이미 작성한 답변이 있으면 내용을 UPDATE 합니다.
      const { error: updateError } = await supabaseAdmin
        .from('help_desk_comments')
        .update({ content: content })
        .eq('id', existingComment.id);

      if (updateError) throw updateError;
    } else {
      // 작성한 답변이 없으면 새로 INSERT 합니다.
      const { error: insertError } = await supabaseAdmin
        .from('help_desk_comments')
        .insert({
          question_id: questionId,
          user_id: user.id, // 답변한 관리자(현재 로그인한 유저)의 ID
          content: content,
        });

      if (insertError) throw insertError;
    }

    // 3. 불필요한 is_answered 컬럼 업데이트 로직은 제거합니다.
    // 관리자 댓글이 생성되면, 답변 상태는 자동으로 '완료'로 취급됩니다.

    return NextResponse.json({ message: 'Answer submitted successfully' });

  } catch (err) {
    console.error('Error in POST /api/admin/help-desk/[id]/answer:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
