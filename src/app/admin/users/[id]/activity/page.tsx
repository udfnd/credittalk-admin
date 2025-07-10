// src/app/admin/users/[id]/activity/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface UserProfile {
  name: string;
  phone_number: string;
  job_type: string;
}

// API에서 오는 다양한 게시글의 타입을 포함할 수 있는 유연한 타입
interface GenericPost {
  id: number;
  title?: string; // title이 없는 게시글 유형(new_crime_cases)도 있음
  method?: string; // new_crime_cases의 경우
  created_at: string;
  category?: string;
  boardType: 'community' | 'review' | 'notice' | 'incident-photo' | 'arrest-news' | 'help-question' | 'new-crime-case';
}

interface UserComment {
  id: number;
  content: string;
  created_at: string;
  post_id?: number; // 댓글이 달린 원본 글 ID
  question_id?: number; // 문의 답변의 경우
  board_type?: string; // 댓글이 달린 게시판 종류
}

// API 응답 구조에 맞게 posts 타입을 수정
interface UserActivity {
  user: UserProfile | null;
  posts: {
    new_crime_cases: Array<{ id: number; method: string; created_at: string; }>;
    reviews: Array<{ id: number; title: string; created_at: string; }>;
    incident_photos: Array<{ id: number; title: string; created_at: string; }>;
    community_posts: Array<{ id: number; title: string; created_at: string; category: string }>;
    help_questions: Array<{ id: number; title: string; created_at: string; }>;
  };
  comments: UserComment[];
}


export default function UserActivityPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchActivity = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/users/${userId}/activity`);
        if (!response.ok) {
          throw new Error('사용자 활동 정보를 불러오는 데 실패했습니다.');
        }
        const data = await response.json();
        setActivity(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류 발생';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();
  }, [userId]);

  // --- 모든 게시글을 하나의 배열로 통합하고 정렬 ---
  const allPosts = useMemo((): GenericPost[] => {
    if (!activity?.posts) return [];

    const {
      community_posts = [],
      reviews = [],
      incident_photos = [],
      new_crime_cases = [],
      help_questions = [],
    } = activity.posts;

    const combined = [
      ...community_posts.map(p => ({ ...p, boardType: 'community', title: p.title || '제목 없음' } as GenericPost)),
      ...reviews.map(p => ({ ...p, boardType: 'review', title: p.title || '제목 없음' } as GenericPost)),
      ...incident_photos.map(p => ({ ...p, boardType: 'incident-photo', title: p.title || '제목 없음' } as GenericPost)),
      ...new_crime_cases.map(p => ({ ...p, boardType: 'new-crime-case', title: p.method || '내용 없음' } as GenericPost)),
      ...help_questions.map(p => ({ ...p, boardType: 'help-question', title: p.title || '제목 없음' } as GenericPost)),
    ];

    // 최신순으로 정렬
    return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [activity]);

  if (isLoading) return <div className="text-center p-8">로딩 중...</div>;
  if (error) return <div className="text-center text-red-500 p-8">오류: {error}</div>;
  if (!activity || !activity.user) return <div className="text-center p-8">사용자 정보를 찾을 수 없습니다.</div>;

  return (
    <div className="container mx-auto p-4">
      <button onClick={() => router.back()} className="mb-6 text-indigo-600 hover:underline">
        &larr; 사용자 목록으로 돌아가기
      </button>

      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{activity.user.name}</h1>
        <div className="text-gray-600 mt-2">
          <p><strong>연락처:</strong> {activity.user.phone_number}</p>
          <p><strong>직업군:</strong> {activity.user.job_type}</p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">작성한 글 ({allPosts.length}개)</h2>
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {allPosts.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {allPosts.map(post => (
                <li key={`${post.boardType}-${post.id}`} className="p-4 hover:bg-gray-50">
                  <div>
                    <p className="font-semibold text-indigo-600 truncate">{post.title}</p>
                    <p className="text-sm text-gray-500">
                      종류: {post.boardType} | 작성일: {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-gray-500">작성한 글이 없습니다.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">작성한 댓글 ({activity.comments.length}개)</h2>
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {activity.comments.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {activity.comments.map(comment => (
                <li key={`comment-${comment.id}`} className="p-4 hover:bg-gray-50">
                  <div>
                    <p className="text-gray-700 truncate">{comment.content}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      작성일: {new Date(comment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-gray-500">작성한 댓글이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
