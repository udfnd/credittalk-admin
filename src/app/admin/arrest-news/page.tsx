// src/app/admin/arrest-news/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface ArrestNews {
  id: number;
  created_at: string;
  title: string;
  author_name: string;
  is_published: boolean;
}

export default function ManageArrestNewsPage() {
  const supabase = createClientComponentClient();
  const [news, setNews] = useState<ArrestNews[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = async () => {
    setIsLoading(true);
    // RLS 정책에 의해 service_role만 접근 가능하므로 API 라우트를 사용합니다.
    const response = await fetch('/api/admin/arrest-news');
    if (!response.ok) {
      setError('데이터를 불러오는 데 실패했습니다.');
      setIsLoading(false);
      return;
    }
    const data = await response.json();
    setNews(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleDelete = async (id: number) => {
    if (window.confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
      await fetch(`/api/admin/arrest-news/${id}`, { method: 'DELETE' });
      await fetchNews(); // 목록 새로고침
    }
  };

  if (isLoading) return <p className="text-center py-8">목록을 불러오는 중...</p>;
  if (error) return <p className="text-center text-red-500 py-8">오류: {error}</p>;

  return (
    <div className="container mx-auto p-0 md:p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">검거소식 관리</h1>
        <Link href="/admin/arrest-news/create" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          새 글 작성
        </Link>
      </div>
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 responsive-table">
          <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제목</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작성자</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작성일</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
          </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 md:divide-y-0">
          {news.map(item => (
            <tr key={item.id}>
              <td data-label="제목" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.title}</td>
              <td data-label="작성자" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.author_name}</td>
              <td data-label="상태" className="px-6 py-4 whitespace-nowrap text-sm">
                {item.is_published
                  ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">게시됨</span>
                  : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">숨김</span>
                }
              </td>
              <td data-label="작성일" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(item.created_at).toLocaleDateString()}</td>
              <td data-label="작업" className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-4">
                <Link href={`/admin/arrest-news/${item.id}/edit`} className="text-indigo-600 hover:text-indigo-900">수정</Link>
                <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">삭제</button>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
