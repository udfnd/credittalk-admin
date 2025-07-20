// src/components/ReviewForm.tsx
'use client'

import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// initialData를 위한 타입 정의 추가
interface ReviewData {
  id?: number;
  title: string;
  content: string;
  rating: number;
  is_published: boolean;
  image_urls?: string[];
}

type ReviewInputs = {
  title: string;
  content: string;
  rating: number;
  is_published: boolean;
  imageFile?: FileList; // 이미지 파일 필드 추가
};

interface ReviewFormProps {
  initialData?: ReviewData; // 수정 모드를 위한 initialData prop
}

export default function ReviewForm({ initialData }: ReviewFormProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ReviewInputs>({
    defaultValues: initialData || {
      is_published: true,
      rating: 5,
    }
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isEditMode = !!initialData;

  const onSubmit: SubmitHandler<ReviewInputs> = async (data) => {
    setMessage(null);
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('content', data.content);
    formData.append('rating', String(data.rating));
    formData.append('is_published', String(data.is_published));

    if (data.imageFile && data.imageFile.length > 0) {
      for (let i = 0; i < data.imageFile.length; i++) {
        formData.append('imageFile', data.imageFile[i]);
      }
    }

    const url = isEditMode ? `/api/admin/reviews/${initialData?.id}` : '/api/admin/reviews';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        body: formData, // JSON이 아닌 FormData 전송
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'An error occurred');
      }

      setMessage({ type: 'success', text: `후기가 성공적으로 ${isEditMode ? '수정' : '생성'}되었습니다.` });

      if (!isEditMode) reset();

      router.refresh();
      setTimeout(() => router.push('/admin/reviews'), 1500);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setMessage({ type: 'error', text: errorMessage });
    }
  };

  return (
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
          {...register('title', { required: '제목은 필수입니다.' })}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700">내용</label>
        <textarea
          id="content"
          rows={10}
          {...register('content', { required: '내용은 필수입니다.' })}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
        />
        {errors.content && <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>}
      </div>

      {/* 이미지 업로드 필드 추가 */}
      <div>
        <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700">
          이미지 (최대 3장) {isEditMode && '(변경할 경우에만 업로드)'}
        </label>
        <input
          id="imageFile"
          type="file"
          accept="image/*"
          multiple
          {...register('imageFile', {
            validate: (files) => (files && files.length > 3) ? '최대 3개의 이미지만 업로드할 수 있습니다.' : true,
          })}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
        {errors.imageFile && <p className="mt-1 text-sm text-red-600">{errors.imageFile.message}</p>}
        {initialData?.image_urls && initialData.image_urls.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">현재 이미지:</p>
            <div className="flex flex-wrap gap-4">
              {initialData.image_urls.map((url, index) => (
                <img key={index} src={url} alt={`후기 이미지 ${index + 1}`} className="w-32 h-32 object-cover rounded"/>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="rating" className="block text-sm font-medium text-gray-700">평점</label>
        <select
          id="rating"
          {...register('rating', { required: true, valueAsNumber: true })}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
        >
          {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'⭐'.repeat(n)}</option>)}
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
      >
        {isSubmitting ? (isEditMode ? '수정 중...' : '생성 중...') : (isEditMode ? '수정하기' : '생성하기')}
      </button>
    </form>
  );
}
