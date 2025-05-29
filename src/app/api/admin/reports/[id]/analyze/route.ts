// src/app/api/admin/reports/[id]/analyze/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { type NextRequest, NextResponse } from 'next/server';
// 다른 API 라우트와 일관성을 위해 src/lib/supabase/server.ts의 createClient 사용
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function PUT(
  request: NextRequest,
  // Next.js App Router의 표준적인 동적 라우트 파라미터 시그니처 사용
  { params }: { params: { id: string } }
) {
  const reportId = params.id; // 파라미터 직접 접근

  if (!reportId) { // reportId 유효성 검사 위치 변경 (인증 전에도 가능)
    return new NextResponse(
      JSON.stringify({ error: 'Report ID is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const cookieStore = await cookies(); // d.ts 파일 기준 await 사용
  const supabaseUserClient = createClient(cookieStore);

  const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();

  if (authError || !user) {
    console.error(`API Authentication Error in analyze/route (PUT) for report ${reportId}:`, authError?.message || 'No user object found in session.');
    return new NextResponse(
      JSON.stringify({ error: `Unauthorized: User not authenticated. ${authError?.message || ''}` }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  console.log(`API Authenticated User in analyze/route (PUT) for report ${reportId}:`, user.id);

  // 관리자 여부 확인
  const { data: adminProfile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('auth_user_id', user.id)
    .single();

  if (profileError || !adminProfile?.is_admin) {
    console.warn(`Forbidden access attempt by user ${user.id} for report ${reportId}. Not an admin. Profile error: ${profileError?.message}`);
    return new NextResponse(
      JSON.stringify({ error: `Forbidden: User is not an admin. ${profileError?.message || ''}` }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  console.log(`API Admin Check Passed for user ${user.id} in analyze/route (PUT) for report ${reportId}`);


  try {
    const body = await request.json();
    const { analysis_result, analysis_message } = body;

    if (analysis_result === undefined || analysis_message === undefined) {
      return new NextResponse(
        JSON.stringify({ error: 'Analysis result and message are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updateData = {
      analysis_result: analysis_result || null,
      analysis_message: analysis_message || null,
      analyzed_at: new Date().toISOString(),
      analyzer_id: user.id,
    };

    console.log('API Update Payload for report ID', reportId, 'in analyze/route:', updateData);

    const { data, error: updateError } = await supabaseAdmin
      .from('scammer_reports')
      .update(updateData)
      .eq('id', reportId)
      .select()
      .single();

    if (updateError) {
      console.error('Supabase Update Error (analyze report):', updateError);
      return new NextResponse(
        JSON.stringify({ error: `Database Error: ${updateError.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (!data) {
      console.error('API Update: Report not found or update failed for ID in analyze/route:', reportId);
      return new NextResponse(
        JSON.stringify({ error: 'Report not found or update failed' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('API Update successful for report ID in analyze/route:', reportId, 'Data:', data);
    return NextResponse.json(data);

  } catch (err) {
    console.error('API Uncaught Error (analyze report):', err);
    let errorMessage = 'An unknown error occurred';
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'string') {
      errorMessage = err;
    }
    return new NextResponse(
      JSON.stringify({ error: `Internal Server Error: ${errorMessage}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
