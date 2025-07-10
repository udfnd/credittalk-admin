// src/app/admin/all-posts/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface UnifiedPost {
  id: number;
  type: string;
  type_ko: string;
  title: string;
  created_at: string;
  author_name: string;
  user_id: string;
}

export default function AllPostsPage() {
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 각 게시물별 댓글 입력을 관리하기 위한 state
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/all-posts');
      if (!response.ok) {
        throw new Error('데이터를 불러오는 데 실패했습니다.');
      }
      const data = await response.json();
      setPosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleDelete = async (post: UnifiedPost) => {
    if (window.confirm(`정말로 "${post.title}" 게시물을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      try {
        const response = await fetch(`/api/admin/all-posts/${post.type}/${post.id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(errorData || '삭제에 실패했습니다.');
        }

        setPosts(prevPosts => prevPosts.filter(p => p.id !== post.id || p.type !== post.type));
        alert('게시물이 성공적으로 삭제되었습니다.');

      } catch (err) {
        alert(`오류: ${err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'}`);
      }
    }
  };

  // 댓글 입력 핸들러
  const handleCommentChange = (postKey: string, value: string) => {
    setCommentInputs(prev => ({ ...prev, [postKey]: value }));
  };

  // 댓글 제출 핸들러
  const handleCommentSubmit = async (post: UnifiedPost) => {
    const postKey = `${post.type}-${post.id}`;
    const content = commentInputs[postKey];

    if (!content || content.trim() === '') {
      alert('댓글 내용을 입력해주세요.');
      return;
    }

    try {
      const response = await fetch('/api/admin/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          boardType: post.type,
          content: content,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || '댓글 작성에 실패했습니다.');
      }

      alert('댓글이 성공적으로 작성되었습니다.');
      // 입력창 비우기
      setCommentInputs(prev => ({ ...prev, [postKey]: '' }));

    } catch (err) {
      alert(`오류: ${err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'}`);
    }
  };


  const getPostLink = (post: UnifiedPost): string => {
    switch (post.type) {
      case 'community_posts':
        return `/admin/posts/${post.id}/edit`;
      case 'reviews':
        return `/admin/reviews/${post.id}/edit`;
      case 'incident_photos':
        return `/admin/incident-photos/${post.id}/edit`;
      case 'help_questions':
        return `/admin/help-desk/${post.id}`;
      case 'notices':
        return `/admin/notices/${post.id}/edit`;
      case 'arrest_news':
        return `/admin/arrest-news/${post.id}/edit`;
      case 'new_crime_cases':
      default:
        return '#';
    }
  };

  const getAuthorLink = (userId: string): string => {
    return `/admin/users/${userId}/activity`;
  };

  if (loading) return <p className="text-center py-8">통합 게시물을 불러오는 중...</p>;
  if (error) return <p className="text-center text-red-500 py-8">오류: {error}</p>;

  return (
    <div className="container mx-auto p-0 md:p-4">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">통합 게시물 관리</h1>

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">게시판</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제목</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작성자</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작성일</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">댓글 작성</th>
          </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
          {posts.map(post => {
            const postKey = `${post.type}-${post.id}`;
            return (
              <tr key={postKey}>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    post.type === 'help_questions' ? 'bg-red-100 text-red-800' :
                      post.type === 'reviews' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                  }`}>
                    {post.type_ko}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 truncate max-w-sm">
                  {getPostLink(post) !== '#' ? (
                    <Link href={getPostLink(post)} className="hover:underline">
                      {post.title}
                    </Link>
                  ) : (
                    <span>{post.title}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <Link href={getAuthorLink(post.user_id)} className="hover:underline text-indigo-600">
                    {post.author_name}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(post.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-4">
                  <button
                    onClick={() => handleDelete(post)}
                    className="text-red-600 hover:text-red-900"
                  >
                    삭제
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    <textarea
                      value={commentInputs[postKey] || ''}
                      onChange={(e) => handleCommentChange(postKey, e.target.value)}
                      placeholder="댓글을 입력하세요..."
                      rows={1}
                      className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => handleCommentSubmit(post)}
                      className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-md hover:bg-indigo-700"
                    >
                      등록
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
