// src/app/admin/view/[type]/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

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
  image_urls?: string[] | null;
  link_url?: string | null;
}

const TYPE_TO_KOREAN: { [key: string]: string } = {
  'notices': '공지사항',
  'arrest-news': '검거소식',
  'reviews': '후기',
  'incident-photos': '사건 사진자료',
  'new-crime-cases': '신종범죄 사례',
  'posts': '커뮤니티 글',
  'community_posts': '커뮤니티 글', // posts 페이지와의 호환성을 위한 별칭
};

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const type = params.type as string;
  const id = params.id as string;

  const [post, setPost] = useState<PostDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!type || !id) return;

    const fetchPostDetails = async () => {
      setLoading(true);
      try {
        // 모든 게시글 타입을 가져올 수 있는 기존 API를 재사용합니다.
        const apiType = type === 'posts' ? 'community_posts' : type;
        const response = await fetch(`/api/admin/all-posts/${apiType}/${id}`);
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

    fetchPostDetails();
  }, [type, id]);

  const getEditLink = () => {
    // 'posts' 와 'community_posts' 모두 /admin/posts/.../edit 로 연결되도록 처리합니다.
    const typeForEdit = type === 'community_posts' ? 'posts' : type;
    return `/admin/${typeForEdit}/${id}/edit`;
  }

  if (loading) return <div className="text-center p-8">로딩 중...</div>;
  if (error) return <div className="text-center text-red-500 p-8">오류: {error}</div>;
  if (!post) return <div className="text-center p-8">게시물을 찾을 수 없습니다.</div>;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <button onClick={() => router.back()} className="text-indigo-600 hover:underline">
            &larr; 목록으로 돌아가기
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{post.title}</h1>
          <div className="text-sm text-gray-500 mt-1">
            <span>게시판: {TYPE_TO_KOREAN[type] || type}</span>
            <span className="mx-2">|</span>
            <span>작성자: {post.author?.name || '정보 없음'}</span>
            <span className="mx-2">|</span>
            <span>작성일: {new Date(post.created_at).toLocaleString()}</span>
          </div>
        </div>
        <Link href={getEditLink()} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          수정하기
        </Link>
      </div>


      {/* 본문 내용 */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <div className="prose max-w-none text-gray-800 whitespace-pre-wrap mb-6">
          {post.content}
        </div>

        {/* 관련 링크 */}
        {post.link_url && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">관련 링크</h3>
            <a href={post.link_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">{post.link_url}</a>
          </div>
        )}

        {/* 첨부 이미지 */}
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

      {/* 댓글 */}
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
