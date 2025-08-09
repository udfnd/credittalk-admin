// src/app/api/admin/help-desk/[id]/publish/route.ts
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {

  const { id } = await params;

  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const questionId = Number(id);
    const { publish } = await request.json();

    if (publish) {
      // 공개 처리: new_crime_cases에 등록
      const { data: question, error: questionError } = await supabaseAdmin
        .from('help_questions')
        .select('case_summary, content, user_id')
        .eq('id', questionId)
        .single();

      if (questionError || !question) {
        throw new Error('해당 문의를 찾을 수 없습니다.');
      }

      // new_crime_cases 테이블에 삽입 또는 업데이트 (upsert)
      const { error: upsertError } = await supabaseAdmin
        .from('new_crime_cases')
        .upsert({
          title: question.case_summary, // 문의 제목을 범죄 수법으로 사용
          method: question.content, // 문의 제목을 범죄 수법으로 사용
          is_published: true,
          user_id: question.user_id, // 문의 작성자를 사례 작성자로 지정
          source_help_question_id: questionId, // 원본 문의 ID 저장
        }, {
          onConflict: 'source_help_question_id',
        });

      if (upsertError) {
        console.error("Error upserting new_crime_case:", upsertError);
        throw upsertError;
      }
    } else {
      // 비공개 처리: new_crime_cases에서 삭제
      const { error: deleteError } = await supabaseAdmin
        .from('new_crime_cases')
        .delete()
        .eq('source_help_question_id', questionId);

      if (deleteError) {
        // 해당 항목이 없을 때 발생하는 오류(PGRST116)는 무시
        if (deleteError.code !== 'PGRST116') {
          console.error("Error deleting new_crime_case:", deleteError);
          throw deleteError;
        }
      }
    }

    return NextResponse.json({ message: `문의가 성공적으로 ${publish ? '공개' : '비공개'} 처리되었습니다.` });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
