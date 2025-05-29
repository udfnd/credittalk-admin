// src/app/api/admin/reports/[id]/analyze/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin'; // 서비스 키 클라이언트
import { createClient } from '@/lib/supabase/server'; // 인증 확인용 (미들웨어에서 처리 권장)
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';

// 미들웨어에서 관리자 인증을 처리한다고 가정합니다.
// 만약 이 API 라우트에서 직접 인증을 확인해야 한다면, 이전 isAdmin 함수와 유사한 로직 추가

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 실제 운영 환경에서는 미들웨어를 통해 관리자 인증이 완료되었다고 가정합니다.
  // 필요시 여기서 추가적인 관리자 확인 로직을 넣을 수 있습니다.
  // const supabaseUserClient = createClient();
  // const { data: { user } } = await supabaseUserClient.auth.getUser();
  // const { data: profile, error: profileError } = await supabaseUserClient.from('users').select('is_admin').eq('auth_user_id', user?.id).single();
  // if (profileError || !profile?.is_admin) {
  //   return new NextResponse('Unauthorized', { status: 401 });
  // }

  const reportId = params.id;
  if (!reportId) {
    return new NextResponse('Report ID is required', { status: 400 });
  }

  try {
    const { analysis_result, analysis_message } = await request.json();

    if (!analysis_result || !analysis_message) {
      return new NextResponse('Analysis result and message are required', { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('scammer_reports')
      .update({
        analysis_result,
        analysis_message,
        analyzed_at: new Date().toISOString(), // 현재 시간으로 분석 시간 기록
        // analyzer_id: user?.id // 분석한 관리자 ID 기록 (인증된 사용자 ID 사용 시)
      })
      .eq('id', reportId)
      .select()
      .single();

    if (error) {
      console.error('Supabase Update Error:', error);
      return new NextResponse(`Database Error: ${error.message}`, { status: 500 });
    }
    if (!data) {
      return new NextResponse('Report not found or update failed', { status: 404 });
    }

    return NextResponse.json(data);

  } catch (err) {
    console.error('API Error:', err);
    let errorMessage = 'An unknown error occurred';
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'string') {
      errorMessage = err;
    }
    return new NextResponse(`Internal Server Error: ${errorMessage}`, { status: 500 });
  }
}
