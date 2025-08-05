// src/components/PostForm.tsx
'use client'

import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 폼 데이터 타입을 정의합니다.
type PostInputs = {
  title: string;
  content: string;
  category: string;
  imageFile?: FileList;
};

// 수정 시 초기 데이터를 받기 위한 타입
interface PostData extends PostInputs {
  id?: number;
  image_urls?: string[];
}

// 컴포넌트 Props 타입 정의
interface PostFormProps {
  initialData?: PostData;
}

export default function PostForm({ initialData }: PostFormProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PostInputs>({
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

    if (data.imageFile && data.imageFile.length > 0) {
      for (let i = 0; i < data.imageFile.length; i++) {
        formData.append('imageFile', data.imageFile[i]);
      }
    }

    // 수정 모드와 생성 모드에 따라 URL과 HTTP 메서드를 동적으로 결정합니다.
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

      <div>
        <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700">
          이미지 (최대 3장) {isEditMode && '(변경할 경우에만 업로드)'} <p className="text-red-600">* 이미지 첨부는 필수입니다.</p>
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
                <img key={index} src={url} alt={`커뮤니티 이미지 ${index + 1}`} className="w-32 h-32 object-cover rounded"/>
              ))}
            </div>
          </div>
        )}
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
