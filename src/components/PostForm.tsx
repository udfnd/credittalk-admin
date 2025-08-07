// src/components/PostForm.tsx
'use client'

import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from './ImageUpload'; // [수정됨] ImageUpload 컴포넌트를 임포트합니다.

// [수정됨] FormInputs 타입을 개별 이미지 파일 필드에 맞게 수정합니다.
type PostInputs = {
  title: string;
  content: string;
  category: string;
  imageFile_0?: FileList;
  imageFile_1?: FileList;
  imageFile_2?: FileList;
};

// 수정 시 초기 데이터를 받기 위한 타입
interface PostData {
  id?: number;
  title: string;
  content: string;
  category: string;
  image_urls?: string[];
}

// 컴포넌트 Props 타입 정의
interface PostFormProps {
  initialData?: PostData;
}

export default function PostForm({ initialData }: PostFormProps) {
  const router = useRouter();
  // [수정됨] useForm에서 watch와 setValue를 추가로 가져옵니다.
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<PostInputs>({
    defaultValues: initialData || {},
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isEditMode = !!initialData;

  const onSubmit: SubmitHandler<PostInputs> = async (data) => {
    setMessage(null);
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('content', data.content);
    formData.append('category', data.category);

    // [수정됨] 개별 파일 필드에서 파일을 수집하여 FormData에 추가합니다.
    for (let i = 0; i < 3; i++) {
      const fileList = data[`imageFile_${i}` as keyof PostInputs] as FileList | undefined;
      if (fileList && fileList.length > 0) {
        formData.append('imageFile', fileList[0]);
      }
    }

    const url = isEditMode ? `/api/admin/posts/${initialData?.id}` : '/api/admin/posts';
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

      setMessage({ type: 'success', text: `게시글이 성공적으로 ${isEditMode ? '수정' : '생성'}되었습니다.` });

      if (!isEditMode) reset();

      router.refresh();
      setTimeout(() => router.push('/admin/posts'), 1500);

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
        <label htmlFor="category" className="block text-sm font-medium text-gray-700">카테고리</label>
        <input
          id="category"
          {...register('category', { required: '카테고리는 필수입니다.' })}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
          placeholder="(카테고리를 적어주세요. #소식공유 #검거완료 #신종범죄)"
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

      {/* [수정됨] 기존 input을 ImageUpload 컴포넌트로 교체합니다. */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          이미지 (최대 3장, 선택 사항)
        </label>
        <ImageUpload
          register={register}
          watch={watch}
          setValue={setValue}
          initialImageUrls={initialData?.image_urls || []}
        />
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
