// src/components/NewCrimeCaseForm.tsx
'use client'

import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from './ImageUpload';

type NewCrimeCase = {
  id?: number;
  title: string;
  category?: string;
  method: string;
  image_urls?: string[];
  link_url?: string; // [수정됨] link_url 타입 추가
  is_published: boolean;
};

type FormInputs = Omit<NewCrimeCase, 'image_urls'> & {
  imageFile_0?: FileList;
  imageFile_1?: FileList;
  imageFile_2?: FileList;
};

interface NewCrimeCaseFormProps {
  initialData?: NewCrimeCase;
}

export default function NewCrimeCaseForm({ initialData }: NewCrimeCaseFormProps) {
  const router = useRouter();

  const getSanitizedInitialValues = () => {
    if (!initialData) {
      return { is_published: true };
    }
    const { image_urls, ...formDefaults } = initialData;
    return formDefaults;
  };

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormInputs>({
    defaultValues: getSanitizedInitialValues(),
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isEditMode = !!initialData;

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    setMessage(null);
    const formData = new FormData();

    formData.append('title', data.title);
    formData.append('method', data.method);
    formData.append('is_published', String(data.is_published));
    formData.append('category', data.category || '');
    formData.append('link_url', data.link_url || '');

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

    const url = isEditMode ? `/api/admin/new-crime-cases/${initialData?.id}` : '/api/admin/new-crime-cases';
    const method = 'POST';

    try {
      const response = await fetch(url, { method, body: formData });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'An error occurred');
      }

      setMessage({ type: 'success', text: `신종범죄 사례가 성공적으로 ${isEditMode ? '수정' : '생성'}되었습니다.` });

      if (!isEditMode) reset();

      router.refresh();
      if (isEditMode) {
        setTimeout(() => router.push('/admin/new-crime-cases'), 1500);
      }

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
          {...register('category')}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
          placeholder="(카테고리를 적어주세요. #소식공유 #검거완료 #신종범죄)"
        />
      </div>
      <div>
        <label htmlFor="method" className="block text-sm font-medium text-gray-700">범죄 수법</label>
        <textarea
          id="method"
          rows={10}
          {...register('method', { required: '범죄 수법은 필수입니다.' })}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
        />
        {errors.method && <p className="mt-1 text-sm text-red-600">{errors.method.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          관련 이미지 {isEditMode && '(변경할 경우에만 업로드)'}
          <p className="text-red-600 inline-block ml-2">* 이미지 첨부는 필수입니다.</p>
        </label>
        <ImageUpload
          register={register}
          watch={watch}
          setValue={setValue}
          initialImageUrls={initialData?.image_urls || []}
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
        {isSubmitting ? '저장 중...' : (isEditMode ? '수정하기' : '생성하기')}
      </button>
    </form>
  );
}
