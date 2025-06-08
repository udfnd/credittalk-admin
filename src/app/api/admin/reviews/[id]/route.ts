// src/app/api/admin/reviews/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

async function isRequestFromAdmin(request: NextRequest): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

// 단일 후기 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!await isRequestFromAdmin(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) {
    return new NextResponse(error.message, { status: 404 });
  }

  return NextResponse.json(data);
}

// 후기 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!await isRequestFromAdmin(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const body = await request.json();
  const { error } = await supabaseAdmin
    .from('reviews')
    .update({
      title: body.title,
      content: body.content,
      rating: body.rating,
      is_published: body.is_published
    })
    .eq('id', params.id);

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}

// 후기 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!await isRequestFromAdmin(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from('reviews')
    .delete()
    .eq('id', params.id);

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
