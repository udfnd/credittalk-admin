// src/app/api/admin/reports/[id]/analyze/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin'; // 서비스 키를 사용하는 Supabase 클라이언트
import { type NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // 서버 컴포넌트/라우트 핸들러용
import { cookies } from 'next/headers';

interface RouteHandlerContext {
  params: {
    id: string; // [id] 세그먼트에 해당
  };
}

export async function PUT(
  request: NextRequest,
  context: RouteHandlerContext // 수정된 타입 적용
) {
  const reportId = context.params.id; // context 객체를 통해 params 접근

  const cookieStore = cookies();
  const supabaseUserClient = createRouteHandlerClient({ cookies: () => cookieStore });

  const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();

  if (authError || !user) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized: User not authenticated.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // public.users 테이블에서 is_admin 플래그 확인 (서비스 키 클라이언트 사용)
  const { data: adminProfile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('auth_user_id', user.id)
    .single();

  if (profileError || !adminProfile?.is_admin) {
    return new NextResponse(
      JSON.stringify({ error: 'Forbidden: User is not an admin.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  // 관리자 인증 완료

  if (!reportId) {
    return new NextResponse(
      JSON.stringify({ error: 'Report ID is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

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
      analyzer_id: user.id, // 분석을 수행한 관리자의 ID
    };

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
      return new NextResponse(
        JSON.stringify({ error: 'Report not found or update failed' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return NextResponse.json(data);

  } catch (err) {
    console.error('API Error (analyze report):', err);
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
