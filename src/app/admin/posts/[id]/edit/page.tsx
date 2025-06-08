// src/app/admin/posts/[id]/edit/page.tsx
'use client';

import { useForm, SubmitHandler } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type PostInputs = {
  title: string;
  content: string;
  category: string;
};

export default function EditPostPage() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PostInputs>();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    if (!id) return;
    const fetchPost = async () => {
      const response = await fetch(`/api/admin/posts/${id}`);
      if (response.ok) {
        const data = await response.json();
        reset(data);
      } else {
        setMessage({ type: 'error', text: '게시글 정보를 불러오지 못했습니다.' });
      }
    };
    fetchPost();
  }, [id, reset]);

  const onSubmit: SubmitHandler<PostInputs> = async (data) => {
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to update post');

      setMessage({ type: 'success', text: '게시글이 성공적으로 수정되었습니다.' });
      setTimeout(() => router.push('/admin/posts'), 1500);
    } catch (err) {
      setMessage({ type: 'error', text: '수정 중 오류가 발생했습니다.' });
    }
  };

  return (
    <div className="container mx-auto p-0 md:p-4">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">커뮤니티 글 수정</h1>
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
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">카테고리</label>
          <input
            id="category"
            {...register('category', { required: '카테고리를 입력하세요' })}
            className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
          />
          {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>}
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700">내용</label>
          <textarea
            id="content"
            rows={10}
            {...register('content')}
            className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
          />
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
