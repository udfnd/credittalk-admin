// src/app/api/admin/users/[id]/activity/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

// 관리자인지 확인하는 헬퍼 함수
async function isRequestFromAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userAuthId = (await params).id; // This is auth_user_id (UUID)

  if (!await isRequestFromAdmin()) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  if (!userAuthId) {
    return new NextResponse('User ID is required', { status: 400 });
  }

  try {
    // 1. 사용자 정보와 public.users.id (bigint) 조회
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, name, phone_number, job_type') // `id` (bigint) for comments table
      .eq('auth_user_id', userAuthId)
      .single();

    if (userError) {
      if (userError.code === 'PGRST116') {
        return new NextResponse('User not found', { status: 404 });
      }
      throw userError;
    }
    const userProfileId = userProfile.id; // The bigint ID for comments table

    // 2. 모든 종류의 게시글 병렬로 조회
    const [
      { data: newCrimeCases, error: newCrimeCasesError },
      { data: reviews, error: reviewsError },
      { data: incidentPhotos, error: incidentPhotosError },
      { data: communityPosts, error: communityPostsError },
      { data: helpQuestions, error: helpQuestionsError }
    ] = await Promise.all([
      supabaseAdmin.from('new_crime_cases').select('id, method, created_at').eq('user_id', userAuthId).order('created_at', { ascending: false }),
      supabaseAdmin.from('reviews').select('id, title, created_at').eq('user_id', userAuthId).order('created_at', { ascending: false }),
      supabaseAdmin.from('incident_photos').select('id, title, created_at').eq('uploader_id', userAuthId).order('created_at', { ascending: false }),
      supabaseAdmin.from('community_posts').select('id, title, created_at, category').eq('user_id', userAuthId).order('created_at', { ascending: false }),
      supabaseAdmin.from('help_questions').select('id, title, created_at').eq('user_id', userAuthId).order('created_at', { ascending: false })
    ]);

    // 에러 핸들링
    if (newCrimeCasesError) throw newCrimeCasesError;
    if (reviewsError) throw reviewsError;
    if (incidentPhotosError) throw incidentPhotosError;
    if (communityPostsError) throw communityPostsError;
    if (helpQuestionsError) throw helpQuestionsError;

    // 3. 작성한 모든 댓글 조회 (public.users.id 사용)
    const { data: comments, error: commentsError } = await supabaseAdmin
      .from('comments')
      .select('id, content, created_at, post_id, board_type')
      .eq('user_id', userProfileId)
      .order('created_at', { ascending: false });

    if (commentsError) throw commentsError;

    // 4. 최종 데이터 조합하여 반환
    return NextResponse.json({
      user: {
        name: userProfile.name,
        phone_number: userProfile.phone_number,
        job_type: userProfile.job_type,
      },
      posts: {
        new_crime_cases: newCrimeCases || [],
        reviews: reviews || [],
        incident_photos: incidentPhotos || [],
        community_posts: communityPosts || [],
        help_questions: helpQuestions || [],
      },
      comments: comments || []
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error fetching user activity for ${userAuthId}:`, errorMessage);
    return new NextResponse(errorMessage, { status: 500 });
  }
}
