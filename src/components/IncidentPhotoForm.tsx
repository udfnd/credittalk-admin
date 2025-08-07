// src/components/IncidentPhotoForm.tsx
'use client'

import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from './ImageUpload'; // [수정됨] ImageUpload 컴포넌트를 임포트합니다.

type IncidentPhoto = {
  id?: number;
  title: string;
  description?: string;
  category?: string;
  image_urls?: string[];
  link_url?: string;
  is_published: boolean;
};

// [수정됨] FormInputs 타입을 개별 이미지 파일 필드에 맞게 수정합니다.
type FormInputs = Omit<IncidentPhoto, 'image_urls'> & {
  imageFile_0?: FileList;
  imageFile_1?: FileList;
  imageFile_2?: FileList;
};

interface IncidentPhotoFormProps {
  initialData?: IncidentPhoto;
}

export default function IncidentPhotoForm({ initialData }: IncidentPhotoFormProps) {
  const router = useRouter();
  // [수정됨] useForm에서 watch와 setValue를 추가로 가져옵니다.
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormInputs>({
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

    // [수정됨] 개별 파일 필드에서 파일을 수집하여 FormData에 추가합니다.
    let fileAttached = false;
    for (let i = 0; i < 3; i++) {
      const fileList = data[`imageFile_${i}` as keyof FormInputs] as FileList | undefined;
      if (fileList && fileList.length > 0) {
        formData.append('imageFile', fileList[0]);
        fileAttached = true;
      }
    }

    if (!isEditMode && !fileAttached) {
      setMessage({ type: 'error', text: '새로운 자료에는 이미지 파일이 필수입니다.' });
      return;
    }

    const url = isEditMode ? `/api/admin/incident-photos/${initialData?.id}` : '/api/admin/incident-photos';
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

      {/* [수정됨] 기존 input을 ImageUpload 컴포넌트로 교체합니다. */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          이미지 파일 {isEditMode && '(변경할 경우에만 업로드)'}
        </label>
        <ImageUpload
          register={register}
          watch={watch}
          setValue={setValue}
          initialImageUrls={initialData?.image_urls || []}
        />
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
          placeholder="(카테고리를 적어주세요. #소식공유 #검거완료 #신종범죄)"
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
