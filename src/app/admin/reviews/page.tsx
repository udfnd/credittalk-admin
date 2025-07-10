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
}

export default function ManageReviewsPage() {
  const supabase = createClientComponentClient();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      setIsLoading(true);
      // `reviews_with_author_profile` 뷰를 사용하여 작성자 정보와 함께 조회합니다.
      const { data, error: fetchError } = await supabase
        .from('reviews_with_author_profile')
        .select('id, created_at, title, rating, author_name, is_published')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error("Error fetching reviews:", fetchError);
        setError("후기 목록을 불러오는 데 실패했습니다.");
      } else {
        setReviews(data as Review[]);
      }
      setIsLoading(false);
    };
    fetchReviews();
  }, [supabase]);

  const handleDelete = async (id: number) => {
    if (window.confirm(`정말로 이 후기를 삭제하시겠습니까?`)) {
      await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      setReviews(reviews.filter(review => review.id !== id));
    }
  };

  if (isLoading) return <p className="text-center py-8">후기 목록을 불러오는 중...</p>;
  if (error) return <p className="text-center text-red-500 py-8">오류: {error}</p>;

  return (
    <div className="container mx-auto p-0 md:p-4">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">후기 관리</h1>
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
            <tr key={review.id}>
              <td data-label="제목" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"><Link href={`/admin/reviews/${review.id}/edit`} className="hover:text-indigo-900">{review.title}</Link></td>
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
