// src/app/admin/reviews/[id]/edit/page.tsx
'use client';

import { useForm, SubmitHandler } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type ReviewInputs = {
  title: string;
  content: string;
  rating: number;
  is_published: boolean;
};

export default function EditReviewPage() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ReviewInputs>();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    if (!id) return;
    const fetchReview = async () => {
      const response = await fetch(`/api/admin/reviews/${id}`);
      if (response.ok) {
        const data = await response.json();
        reset(data); // react-hook-form의 reset으로 폼 필드를 채웁니다.
      } else {
        setMessage({ type: 'error', text: '후기 정보를 불러오지 못했습니다.' });
      }
    };
    fetchReview();
  }, [id, reset]);

  const onSubmit: SubmitHandler<ReviewInputs> = async (data) => {
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to update review');

      setMessage({ type: 'success', text: '후기가 성공적으로 수정되었습니다.' });
      setTimeout(() => router.push('/admin/reviews'), 1500);
    } catch (err) {
      setMessage({ type: 'error', text: `수정 중 오류가 발생했습니다.  ${err}` });
    }
  };

  return (
    <div className="container mx-auto p-0 md:p-4">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">후기 수정</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 bg-white rounded-lg shadow-md space-y-4">
        {message && (
          <div className={`p-3 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">제목</label>
          <input
            id="title"
            {...register('title', { required: '제목을 입력하세요' })}
            className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
          />
          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700">내용</label>
          <textarea
            id="content"
            rows={8}
            {...register('content')}
            className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
          />
        </div>

        <div>
          <label htmlFor="rating" className="block text-sm font-medium text-gray-700">평점</label>
          <select
            id="rating"
            {...register('rating', { required: true, valueAsNumber: true })}
            className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
          >
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="flex items-center">
          <input
            id="is_published"
            type="checkbox"
            {...register('is_published')}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <label htmlFor="is_published" className="ml-2 block text-sm text-gray-900">게시</label>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? '저장 중...' : '저장'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
