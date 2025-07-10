// src/app/api/admin/all-posts/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// 관리자 여부 확인
async function isRequestFromAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

// 모든 게시글을 표준화하기 위한 인터페이스
interface UnifiedPost {
  id: number;
  type: string;
  type_ko: string;
  title: string;
  created_at: string;
  author_name: string;
  user_id: string; // auth.users.id (uuid)
}

export async function GET() {
  if (!(await isRequestFromAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 여러 테이블의 데이터를 병렬로 가져옵니다.
    const [
      { data: communityPosts, error: communityError },
      { data: reviews, error: reviewsError },
      { data: incidentPhotos, error: incidentsError },
      { data: newCrimeCases, error: crimeCasesError },
      { data: helpQuestions, error: helpQuestionsError }
    ] = await Promise.all([
      supabaseAdmin.from('community_posts_with_author_profile').select('id, title, created_at, author_name, author_auth_id'),
      supabaseAdmin.from('reviews_with_author_profile').select('id, title, created_at, author_name, author_auth_id'),
      // incident_photos와 new_crime_cases는 일단 작성자 ID만 가져옵니다.
      supabaseAdmin.from('incident_photos').select('id, title, created_at, uploader_id'),
      supabaseAdmin.from('new_crime_cases').select('id, method, created_at, user_id'),
      supabaseAdmin.from('help_questions_with_author').select('id, title, created_at, user_id, author_name')
    ]);

    // 각 프로미스의 에러를 확인합니다.
    if (communityError) throw new Error(`Community Posts Error: ${communityError.message}`);
    if (reviewsError) throw new Error(`Reviews Error: ${reviewsError.message}`);
    if (incidentsError) throw new Error(`Incident Photos Error: ${incidentsError.message}`);
    if (crimeCasesError) throw new Error(`New Crime Cases Error: ${crimeCasesError.message}`);
    if (helpQuestionsError) throw new Error(`Help Questions Error: ${helpQuestionsError.message}`);

    // incident_photos와 new_crime_cases에서 작성자 UUID를 모두 수집합니다.
    const userIdsToFetch = new Set<string>();
    (incidentPhotos || []).forEach(p => p.uploader_id && userIdsToFetch.add(p.uploader_id));
    (newCrimeCases || []).forEach(p => p.user_id && userIdsToFetch.add(p.user_id));

    let userMap = new Map<string, string>();

    // 조회할 ID가 있는 경우에만 사용자 정보를 가져옵니다.
    if (userIdsToFetch.size > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('auth_user_id, name')
        .in('auth_user_id', Array.from(userIdsToFetch));

      if (usersError) throw usersError;

      // 사용자 ID와 이름을 매핑하는 Map을 생성합니다.
      users.forEach(u => userMap.set(u.auth_user_id, u.name));
    }

    // 가져온 데이터를 표준화된 형식으로 변환합니다.
    const unifiedPosts: UnifiedPost[] = [
      ...(communityPosts || []).map(p => ({ id: p.id, type: 'community_posts', type_ko: '커뮤니티', title: p.title, created_at: p.created_at, author_name: p.author_name || 'N/A', user_id: p.author_auth_id })),
      ...(reviews || []).map(p => ({ id: p.id, type: 'reviews', type_ko: '이용후기', title: p.title, created_at: p.created_at, author_name: p.author_name || 'N/A', user_id: p.author_auth_id })),
      ...(incidentPhotos || []).map(p => ({ id: p.id, type: 'incident_photos', type_ko: '사건/사례', title: p.title, created_at: p.created_at, author_name: userMap.get(p.uploader_id) || 'N/A', user_id: p.uploader_id })),
      ...(newCrimeCases || []).map(p => ({ id: p.id, type: 'new_crime_cases', type_ko: '신종범죄', title: p.method, created_at: p.created_at, author_name: userMap.get(p.user_id) || 'N/A', user_id: p.user_id })),
      ...(helpQuestions || []).map(p => ({ id: p.id, type: 'help_questions', type_ko: '헬프서비스', title: p.title, created_at: p.created_at, author_name: p.author_name || 'N/A', user_id: p.user_id })),
    ];

    // 모든 게시글을 최신순으로 정렬합니다.
    const sortedPosts = unifiedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json(sortedPosts);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error fetching all posts:', errorMessage);
    return new NextResponse(errorMessage, { status: 500 });
  }
}
