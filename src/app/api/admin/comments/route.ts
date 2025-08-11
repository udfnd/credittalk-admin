// src/app/api/admin/comments/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

// [신규] URL 경로(type)를 실제 DB 테이블 이름으로 매핑하는 객체
const TABLE_MAP: { [key: string]: string } = {
  'notices': 'notices',
  'arrest-news': 'arrest_news',
  'reviews': 'reviews',
  'incident-photos': 'incident_photos',
  'new-crime-cases': 'new_crime_cases',
  'posts': 'community_posts',
  'arrest_news': 'arrest_news',
  'incident_photos': 'incident_photos',
  'new_crime_cases': 'new_crime_cases',
  'community_posts': 'community_posts',
  'help_questions': 'help_questions',
};

async function isRequestFromAdmin(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

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
    const { postId, boardType, content, parent_comment_id } = await request.json();

    // [수정됨] 매핑을 통해 올바른 테이블 이름을 가져옵니다.
    const tableName = TABLE_MAP[boardType];

    if (!tableName || !postId || !content) {
      return new NextResponse('Missing or invalid required fields: postId, boardType, content', { status: 400 });
    }

    const adminUserId = await getAdminProfileId(supabase);
    if (!adminUserId) {
      return new NextResponse('Could not find admin profile', { status: 500 });
    }

    const { error } = await supabaseAdmin.from('comments').insert({
      post_id: postId,
      board_type: tableName, // [수정됨] 변환된 테이블 이름을 사용합니다.
      content: content,
      user_id: adminUserId,
      parent_comment_id: parent_comment_id,
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
