// src/app/api/admin/reports/[id]/analyze/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin'; // 서비스 키 클라이언트
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {

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
