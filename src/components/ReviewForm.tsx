// src/components/ReviewForm.tsx
'use client'

import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from './ImageUpload'; // [수정됨] ImageUpload 컴포넌트를 임포트합니다.

// initialData를 위한 타입 정의 추가
interface ReviewData {
  id?: number;
  title: string;
  content: string;
  rating: number;
  is_published: boolean;
  image_urls?: string[];
}

// [수정됨] FormInputs 타입을 개별 이미지 파일 필드에 맞게 수정합니다.
type ReviewInputs = {
  title: string;
  content: string;
  rating: number;
  is_published: boolean;
  imageFile_0?: FileList;
  imageFile_1?: FileList;
  imageFile_2?: FileList;
};

interface ReviewFormProps {
  initialData?: ReviewData; // 수정 모드를 위한 initialData prop
}

export default function ReviewForm({ initialData }: ReviewFormProps) {
  const router = useRouter();
  // [수정됨] useForm에서 watch와 setValue를 추가로 가져옵니다.
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<ReviewInputs>({
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

    // [수정됨] 개별 파일 필드에서 파일을 수집하여 FormData에 추가합니다.
    for (let i = 0; i < 3; i++) {
      const fileList = data[`imageFile_${i}` as keyof ReviewInputs] as FileList | undefined;
      if (fileList && fileList.length > 0) {
        formData.append('imageFile', fileList[0]);
      }
    }

    const url = isEditMode ? `/api/admin/reviews/${initialData?.id}` : '/api/admin/reviews';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        body: formData,
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

      {/* [수정됨] 기존 input을 ImageUpload 컴포넌트로 교체합니다. */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          이미지 (최대 3장) {isEditMode && '(변경할 경우에만 업로드)'}
        </label>
        <ImageUpload
          register={register}
          watch={watch}
          setValue={setValue}
          initialImageUrls={initialData?.image_urls || []}
        />
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
