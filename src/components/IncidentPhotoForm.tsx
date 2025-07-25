// src/components/IncidentPhotoForm.tsx
'use client'

import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type IncidentPhoto = {
  id?: number;
  title: string;
  description?: string;
  category?: string;
  image_urls?: string[]; // image_url -> image_urls
  link_url?: string;
  is_published: boolean;
};

type FormInputs = Omit<IncidentPhoto, 'image_urls'> & {
  imageFile?: FileList;
};

interface IncidentPhotoFormProps {
  initialData?: IncidentPhoto;
}

export default function IncidentPhotoForm({ initialData }: IncidentPhotoFormProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormInputs>({
    defaultValues: initialData || {
      is_published: true,
    }
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isEditMode = !!initialData;

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    setMessage(null);

    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description || '');
    formData.append('category', data.category || '');
    formData.append('is_published', String(data.is_published));
    formData.append('link_url', data.link_url || '');

    if (data.imageFile && data.imageFile.length > 0) {
      for (let i = 0; i < data.imageFile.length; i++) {
        formData.append('imageFile', data.imageFile[i]);
      }
    } else if (!isEditMode) {
      setMessage({ type: 'error', text: '새로운 자료에는 이미지 파일이 필수입니다.' });
      return;
    }

    const url = isEditMode ? `/api/admin/incident-photos/${initialData.id}` : '/api/admin/incident-photos';
    const method = 'POST';

    try {
      const response = await fetch(url, { method, body: formData });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'An error occurred');
      }

      setMessage({ type: 'success', text: `사진 자료가 성공적으로 ${isEditMode ? '수정' : '업로드'}되었습니다.` });

      if (!isEditMode) reset();

      router.refresh();
      if (isEditMode) {
        setTimeout(() => router.push('/admin/incident-photos'), 1500);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setMessage({ type: 'error', text: errorMessage });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 bg-white rounded-lg shadow-md space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">{isEditMode ? '사건 사진자료 수정' : '사건 사진자료 작성'}</h2>

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
        <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700">
          이미지 파일 (최대 3장) {isEditMode && '(변경할 경우에만 업로드)'} <p className="text-red-600">* 이미지 첨부는 필수입니다.</p>
        </label>
        <input
          id="imageFile"
          type="file"
          accept="image/*"
          multiple // multiple 속성 추가
          {...register('imageFile', {
            required: !isEditMode,
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
                <img key={index} src={url} alt={`${initialData.title} 이미지 ${index + 1}`} className="w-32 h-32 object-cover rounded"/>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">설명</label>
        <textarea
          id="description"
          rows={3}
          {...register('description')}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
        />
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700">카테고리</label>
        <input
          id="category"
          {...register('category')}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
          placeholder="(예 : 카테고리를 적어주세요. 소식 공유, 검거 완료, ...)"
        />
      </div>
      <div>
        <label htmlFor="link_url" className="block text-sm font-medium text-gray-700">링크 URL (선택 사항)</label>
        <input
          id="link_url"
          type="url"
          placeholder="https://example.com"
          {...register('link_url')}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
        />
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
        {isSubmitting ? '저장 중...' : (isEditMode ? '수정하기' : '업로드')}
      </button>
    </form>
  );
}
