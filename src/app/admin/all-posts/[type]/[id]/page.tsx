// src/app/admin/all-posts/[type]/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Comment {
  id: number;
  content: string;
  created_at: string;
  author: { name: string; } | null;
}

interface PostDetails {
  id: number;
  title: string;
  content: string;
  created_at: string;
  author: { name: string; } | null;
  comments: Comment[];
  image_urls?: string[]; // 이미지 URL을 위한 필드 추가
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { type, id } = params;

  const [post, setPost] = useState<PostDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPostDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/all-posts/${type}/${id}`);
      if (!response.ok) {
        throw new Error('게시물 정보를 불러오는 데 실패했습니다.');
      }
      const data = await response.json();
      setPost(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (type && id) {
      fetchPostDetails();
    }
  }, [type, id]);

  const handleDeleteComment = async (commentId: number) => {
    if (window.confirm('정말로 이 댓글을 삭제하시겠습니까?')) {
      try {
        const response = await fetch(`/api/admin/comments/${commentId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          throw new Error('댓글 삭제에 실패했습니다.');
        }
        await fetchPostDetails();
        alert('댓글이 삭제되었습니다.');
      } catch (err) {
        alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
      }
    }
  };

  if (loading) return <div className="text-center p-8">로딩 중...</div>;
  if (error) return <div className="text-center text-red-500 p-8">오류: {error}</div>;
  if (!post) return <div className="text-center p-8">게시물을 찾을 수 없습니다.</div>;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <button onClick={() => router.back()} className="mb-6 text-indigo-600 hover:underline">
        &larr; 목록으로 돌아가기
      </button>

      {/* 게시물 내용 */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{post.title}</h1>
        <div className="text-sm text-gray-500 mb-4">
          <span>작성자: {post.author?.name || '정보 없음'}</span>
          <span className="mx-2">|</span>
          <span>작성일: {new Date(post.created_at).toLocaleString()}</span>
        </div>
        <div className="prose max-w-none text-gray-800 whitespace-pre-wrap mb-6">
          {post.content}
        </div>

        {/* 이미지 갤러리 */}
        {post.image_urls && post.image_urls.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">첨부 이미지</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {post.image_urls.map((url, index) => (
                <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`첨부 이미지 ${index + 1}`} className="w-full h-auto object-cover rounded-lg shadow-md hover:opacity-80 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 댓글 목록 */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">댓글 ({post.comments.length}개)</h2>
        <div className="space-y-4">
          {post.comments.length > 0 ? (
            post.comments.map(comment => (
              <div key={comment.id} className="p-4 border rounded-md hover:bg-gray-50 flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-700">{comment.author?.name || '익명'}</p>
                  <p className="text-gray-600 my-1">{comment.content}</p>
                  <p className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold"
                >
                  삭제
                </button>
              </div>
            ))
          ) : (
            <p className="text-gray-500">작성된 댓글이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
