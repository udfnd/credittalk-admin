// src/components/NewCrimeCaseForm.tsx
'use client'

import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type NewCrimeCase = {
  id?: number;
  method: string;
  image_urls?: string[];
  is_published: boolean;
};

type FormInputs = Omit<NewCrimeCase, 'image_urls'> & {
  imageFile?: FileList;
};

interface NewCrimeCaseFormProps {
  initialData?: NewCrimeCase;
}

export default function NewCrimeCaseForm({ initialData }: NewCrimeCaseFormProps) {
  const router = useRouter();

  const getSanitizedInitialValues = () => {
    if (!initialData) {
      return {
        is_published: true,
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { image_urls, ...formDefaults } = initialData;
    return formDefaults;
  };

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormInputs>({
    defaultValues: getSanitizedInitialValues(),
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isEditMode = !!initialData;

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    setMessage(null);
    const formData = new FormData();

    formData.append('method', data.method);
    formData.append('is_published', String(data.is_published));

    if (data.imageFile && data.imageFile.length > 0) {
      for (const file of data.imageFile) {
        formData.append('imageFile', file);
      }
    }

    const url = isEditMode ? `/api/admin/new-crime-cases/${initialData.id}` : '/api/admin/new-crime-cases';
    const method = 'POST';

    try {
      const response = await fetch(url, { method, body: formData });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'An error occurred');
      }

      setMessage({ type: 'success', text: `신종범죄 사례가 성공적으로 ${isEditMode ? '수정' : '생성'}되었습니다.` });

      if (!isEditMode) {
        reset();
      }

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
        <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700">
          관련 이미지 (최대 3장) {isEditMode && '(변경할 경우에만 업로드)'}
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
                <img key={index} src={url} alt={`신종범죄 이미지 ${index + 1}`} className="w-32 h-32 object-cover rounded"/>
              ))}
            </div>
          </div>
        )}
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
