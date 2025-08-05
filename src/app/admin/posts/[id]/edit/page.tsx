// src/app/admin/posts/[id]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PostForm from '@/components/PostForm'; // 통합 폼 컴포넌트를 import 합니다.

// PostForm에서 사용하는 데이터 타입
interface PostData {
  id: number;
  title: string;
  content: string;
  category: string;
  image_urls?: string[];
}

export default function EditPostPage() {
  const params = useParams();
  const id = params.id as string;
  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchPost = async () => {
      setLoading(true);
      const response = await fetch(`/api/admin/posts/${id}`);
      if (response.ok) {
        const data = await response.json();
        setPost(data);
      } else {
        setError('게시글 정보를 불러오지 못했습니다.');
      }
      setLoading(false);
    };
    fetchPost();
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div className="container mx-auto p-0 md:p-4">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">커뮤니티 글 수정</h1>
      {post ? (
        <PostForm initialData={post} />
      ) : (
        <p>해당 게시글을 찾을 수 없습니다.</p>
      )}
    </div>
  );
}
