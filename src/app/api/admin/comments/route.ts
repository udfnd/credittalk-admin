// src/app/api/admin/comments/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

// 관리자 여부 확인
async function isRequestFromAdmin(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

// 현재 로그인한 관리자의 public.users.id (bigint)를 가져오는 함수
async function getAdminProfileId(supabase: ReturnType<typeof createClient>): Promise<number | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (error) {
    console.error('Error fetching admin profile ID:', error);
    return null;
  }
  return profile.id;
}


export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  if (!(await isRequestFromAdmin(supabase))) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { postId, boardType, content } = await request.json();

    if (!postId || !boardType || !content) {
      return new NextResponse('Missing required fields: postId, boardType, content', { status: 400 });
    }

    const adminUserId = await getAdminProfileId(supabase);
    if (!adminUserId) {
      return new NextResponse('Could not find admin profile', { status: 500 });
    }

    const { error } = await supabaseAdmin.from('comments').insert({
      post_id: postId,
      board_type: boardType,
      content: content,
      user_id: adminUserId, // public.users.id (bigint)
    });

    if (error) {
      console.error('Error inserting comment:', error);
      throw error;
    }

    return NextResponse.json({ message: 'Comment added successfully' }, { status: 201 });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
