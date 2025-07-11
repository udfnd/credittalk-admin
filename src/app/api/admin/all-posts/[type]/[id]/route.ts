// src/app/api/admin/all-posts/[type]/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

async function isRequestFromAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

// 각 테이블의 컬럼 정보를 반환하는 함수 수정
function getTableAndContentColumn(type: string): { tableName: string | null; contentColumn: string; titleColumn: string; userColumn: string | null } {
  const tableMap: { [key: string]: { tableName: string; contentColumn: string; titleColumn: string; userColumn: string | null } } = {
    community_posts: { tableName: 'community_posts', contentColumn: 'content', titleColumn: 'title', userColumn: 'user_id' },
    reviews: { tableName: 'reviews', contentColumn: 'content', titleColumn: 'title', userColumn: 'user_id' },
    incident_photos: { tableName: 'incident_photos', contentColumn: 'description', titleColumn: 'title', userColumn: 'uploader_id' },
    new_crime_cases: { tableName: 'new_crime_cases', contentColumn: 'method', titleColumn: 'method', userColumn: 'user_id' },
    help_questions: { tableName: 'help_questions', contentColumn: 'content', titleColumn: 'title', userColumn: 'user_id' },
    notices: { tableName: 'notices', contentColumn: 'content', titleColumn: 'title', userColumn: null }, // user_id 대신 author_name 사용
    arrest_news: { tableName: 'arrest_news', contentColumn: 'content', titleColumn: 'title', userColumn: null }, // user_id 대신 author_name 사용
  };
  return tableMap[type] || { tableName: null, contentColumn: 'content', titleColumn: 'title', userColumn: null };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  const { type, id } = params;

  if (!(await isRequestFromAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { tableName, contentColumn, titleColumn, userColumn } = getTableAndContentColumn(type);

  if (!tableName) {
    return new NextResponse('Invalid post type', { status: 400 });
  }

  try {
    // 1. 게시물 정보 조회
    const { data: post, error: postError } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (postError) throw postError;

    // 2. 작성자 정보 조회 (userColumn이 있는 경우)
    let author = null;
    if (userColumn && post[userColumn]) {
      const { data: authorData } = await supabaseAdmin
        .from('users')
        .select('name')
        .eq('auth_user_id', post[userColumn])
        .single();
      author = authorData;
    } else if (tableName === 'notices' || tableName === 'arrest_news') {
      // user_id가 없는 테이블은 author_name 컬럼을 직접 사용
      author = { name: post.author_name || '관리자' };
    }


    // 3. 댓글 정보와 댓글 작성자 프로필 함께 조회
    const { data: comments, error: commentsError } = await supabaseAdmin
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        author:users ( name )
      `)
      .eq('post_id', id)
      .eq('board_type', tableName)
      .order('created_at', { ascending: true });

    if (commentsError) throw commentsError;

    // 4. 최종 데이터 조합
    const responseData = {
      ...post,
      title: post[titleColumn],
      content: post[contentColumn],
      author,
      comments,
    };

    return NextResponse.json(responseData);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error fetching post details from ${tableName} with id ${id}:`, errorMessage);
    return new NextResponse(errorMessage, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  const { type, id } = params;

  if (!(await isRequestFromAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { tableName } = getTableAndContentColumn(type);


  if (!tableName) {
    return new NextResponse('Invalid post type', { status: 400 });
  }

  try {
    // 댓글 먼저 삭제
    await supabaseAdmin
      .from('comments')
      .delete()
      .eq('post_id', id)
      .eq('board_type', tableName);

    // 게시물 삭제
    const { error } = await supabaseAdmin
      .from(tableName)
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '23503' || error.code === 'PGRST116') {
        return new NextResponse('Item not found or cannot be deleted.', { status: 404 });
      }
      throw error;
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error deleting post from ${tableName} with id ${id}:`, errorMessage);
    return new NextResponse(errorMessage, { status: 500 });
  }
}
