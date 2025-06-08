// src/app/admin/posts/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface Post {
  id: number;
  created_at: string;
  title: string;
  category: string;
  author_name: string;
  views: number;
}

export default function ManagePostsPage() {
  const supabase = createClientComponentClient();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('community_posts_with_author_profile')
        .select('id, created_at, title, category, author_name, views')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error("Error fetching posts:", fetchError);
        setError("게시글 목록을 불러오는 데 실패했습니다.");
      } else {
        setPosts(data as Post[]);
      }
      setIsLoading(false);
    };
    fetchPosts();
  }, [supabase]);

  const handleDelete = async (id: number) => {
    if (window.confirm(`정말로 이 게시글을 삭제하시겠습니까?`)) {
      await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' });
      setPosts(posts.filter(post => post.id !== id));
    }
  };

  if (isLoading) return <p className="text-center py-8">게시글 목록을 불러오는 중...</p>;
  if (error) return <p className="text-center text-red-500 py-8">오류: {error}</p>;

  return (
    <div className="container mx-auto p-0 md:p-4">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">커뮤니티 글 관리</h1>
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 responsive-table">
          <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제목</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작성자</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">조회수</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작성일</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
          </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 md:divide-y-0">
          {posts.map(post => (
            <tr key={post.id}>
              <td data-label="제목" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{post.title}</td>
              <td data-label="작성자" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{post.author_name}</td>
              <td data-label="카테고리" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{post.category}</td>
              <td data-label="조회수" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{post.views}</td>
              <td data-label="작성일" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(post.created_at).toLocaleDateString()}</td>
              <td data-label="작업" className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-4">
                <Link href={`/admin/posts/${post.id}/edit`} className="text-indigo-600 hover:text-indigo-900">수정</Link>
                <button onClick={() => handleDelete(post.id)} className="text-red-600 hover:text-red-900">삭제</button>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
