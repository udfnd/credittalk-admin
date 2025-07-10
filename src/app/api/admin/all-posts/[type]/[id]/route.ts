// src/app/api/admin/all-posts/[type]/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

// 관리자 여부 확인
async function isRequestFromAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

// 각 게시판 타입에 맞는 테이블 이름을 반환하는 함수
function getTableName(type: string): string | null {
  const tableMap: { [key: string]: string } = {
    community_posts: 'community_posts',
    reviews: 'reviews',
    incident_photos: 'incident_photos',
    new_crime_cases: 'new_crime_cases',
    help_questions: 'help_questions',
  };
  return tableMap[type] || null;
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  const { type, id } = params;

  if (!(await isRequestFromAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const tableName = getTableName(type);

  if (!tableName) {
    return new NextResponse('Invalid post type', { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from(tableName)
      .delete()
      .eq('id', id);

    if (error) {
      // RLS (Row Level Security) 위반 또는 존재하지 않는 ID로 인한 오류 처리
      if (error.code === '23503' || error.code === 'PGRST116') {
        return new NextResponse('Item not found or cannot be deleted.', { status: 404 });
      }
      throw error;
    }

    return new NextResponse(null, { status: 204 }); // No Content
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error deleting post from ${tableName} with id ${id}:`, errorMessage);
    return new NextResponse(errorMessage, { status: 500 });
  }
}
