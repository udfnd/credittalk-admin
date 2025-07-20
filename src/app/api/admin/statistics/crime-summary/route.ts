// src/app/api/admin/statistics/crime-summary/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

export async function GET() {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const [
      { data: crimeSummaryData, error: crimeSummaryError },
      { count: helpQuestionsCount, error: helpQuestionsError }
    ] = await Promise.all([
      supabaseAdmin.rpc('get_crime_summary_stats'),
      supabaseAdmin.from('help_questions').select('*', { count: 'exact', head: true })
    ]);

    if (crimeSummaryError) throw crimeSummaryError;
    if (helpQuestionsError) throw helpQuestionsError;

    // 최종 응답 객체에 두 데이터를 결합합니다.
    const responseData = {
      ...crimeSummaryData,
      totalHelpQuestions: helpQuestionsCount ?? 0,
    };

    return NextResponse.json(responseData);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
