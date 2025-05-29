// src/app/api/admin/reports/[id]/analyze/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { type NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const reportId = params.id;

  const cookieStore = cookies();
  const supabaseUserClient = createRouteHandlerClient({ cookies: () => cookieStore });

  const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();

  if (authError || !user) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized: User not authenticated.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

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
      analyzer_id: user.id,
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
