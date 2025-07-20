// src/app/admin/reviews/[id]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ReviewForm from '@/components/ReviewForm'; // 새로 만든 폼 컴포넌트 사용

// ReviewForm 컴포넌트와 타입을 맞춥니다.
interface ReviewData {
  id: number;
  title: string;
  content: string;
  rating: number;
  is_published: boolean;
  image_urls?: string[];
}

export default function EditReviewPage() {
  const params = useParams();
  const id = params.id as string;
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchReview = async () => {
      const response = await fetch(`/api/admin/reviews/${id}`);
      if (response.ok) {
        const data = await response.json();
        setReview(data);
      } else {
        setError('후기 정보를 불러오지 못했습니다.');
      }
      setLoading(false);
    };
    fetchReview();
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div className="container mx-auto p-0 md:p-4">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">후기 수정</h1>
      {review ? (
        <ReviewForm initialData={review} />
      ) : (
        <p>해당 후기를 찾을 수 없습니다.</p>
      )}
    </div>
  );
}
