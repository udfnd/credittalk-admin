// src/app/admin/reviews/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface Review {
  id: number;
  created_at: string;
  title: string;
  rating: number;
  author_name: string;
  is_published: boolean;
  is_pinned: boolean;
}

export default function ManageReviewsPage() {
  const supabase = createClientComponentClient();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = async () => {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('reviews_with_author_profile')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('pinned_at', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error("Error fetching reviews:", fetchError);
      setError("후기 목록을 불러오는 데 실패했습니다: " + fetchError.message);
    } else {
      setReviews(data as Review[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReviews();
  }, [supabase]);

  const handlePinToggle = async (id: number, currentPinStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'reviews', id: id, pin: !currentPinStatus }),
      });
      if (!response.ok) throw new Error('상태 변경에 실패했습니다.');
      await fetchReviews();
    } catch (err) {
      alert(err instanceof Error ? err.message : '알 수 없는 오류');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm(`정말로 이 후기를 삭제하시겠습니까?`)) {
      await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      await fetchReviews();
    }
  };

  if (isLoading) return <p className="text-center py-8">후기 목록을 불러오는 중...</p>;
  if (error) return <p className="text-center text-red-500 py-8">오류: {error}</p>;

  return (
    <div className="container mx-auto p-0 md:p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">후기 관리</h1>
        <Link href="/admin/reviews/create" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          새 후기 작성
        </Link>
      </div>
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 responsive-table">
          <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제목</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작성자</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">평점</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작성일</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
          </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 md:divide-y-0">
          {reviews.map(review => (
            <tr key={review.id} className={review.is_pinned ? 'bg-indigo-50' : ''}>
              <td data-label="제목" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {review.is_pinned && <span className="font-bold text-indigo-600">[고정] </span>}
                <Link href={`/admin/view/reviews/${review.id}`} className="hover:text-indigo-900">{review.title}</Link>
              </td>
              <td data-label="작성자" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{review.author_name}</td>
              <td data-label="평점" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{'⭐'.repeat(review.rating)}</td>
              <td data-label="상태" className="px-6 py-4 whitespace-nowrap text-sm">
                {review.is_published
                  ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">게시됨</span>
                  : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">숨김</span>
                }
              </td>
              <td data-label="작성일" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(review.created_at).toLocaleDateString()}</td>
              <td data-label="작업" className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-4">
                <button onClick={() => handlePinToggle(review.id, review.is_pinned)} className="text-blue-600 hover:text-blue-900">
                  {review.is_pinned ? '고정 해제' : '상단 고정'}
                </button>
                <Link href={`/admin/reviews/${review.id}/edit`} className="text-indigo-600 hover:text-indigo-900">수정</Link>
                <button onClick={() => handleDelete(review.id)} className="text-red-600 hover:text-red-900">삭제</button>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
