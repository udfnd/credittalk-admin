'use client'

import { useForm } from 'react-hook-form';
import { useState } from 'react';

type IncidentPhotoFormData = {
  title: string;
  description?: string;
  category?: string;
  imageFile: FileList;
  is_published: boolean;
};

export default function IncidentPhotoForm() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<IncidentPhotoFormData>({
    defaultValues: {
      is_published: true,
    }
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const onSubmit = async (data: IncidentPhotoFormData) => {
    setMessage(null);
    if (!data.imageFile || data.imageFile.length === 0) {
      setMessage({ type: 'error', text: 'Image file is required.' });
      return;
    }

    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description || '');
    formData.append('category', data.category || '');
    formData.append('imageFile', data.imageFile[0]);
    formData.append('is_published', String(data.is_published));


    try {
      const response = await fetch('/api/admin/incident-photos', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to upload photo');
      }

      setMessage({ type: 'success', text: 'Incident photo uploaded successfully!' });
      reset();
    } catch (err) {
      console.error('Upload Error:', err);
      let errorMessage = 'An unknown error occurred';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      setMessage({ type: 'error', text: errorMessage });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 bg-white rounded-lg shadow-md space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">사건 사진자료 작성</h2>

      {message && (
        <div className={`p-3 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">제목</label>
        <input
          id="title"
          {...register('title', { required: 'Title is required' })}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm"
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
      </div>

      <div>
        <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700">이미지 파일</label>
        <input
          id="imageFile"
          type="file"
          accept="image/*"
          {...register('imageFile', { required: 'Image file is required' })}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm"
        />
        {errors.imageFile && <p className="mt-1 text-sm text-red-600">{errors.imageFile.message}</p>}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">설명</label>
        <textarea
          id="description"
          rows={3}
          {...register('description')}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm"
        />
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700">카테고리</label>
        <input
          id="category"
          {...register('category')}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm"
        />
      </div>

      <div className="flex items-center">
        <input
          id="is_published"
          type="checkbox"
          {...register('is_published')}
          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
        />
        <label htmlFor="is_published" className="ml-2 block text-sm text-gray-900">즉시 업로드</label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
      >
        {isSubmitting ? '업로드 중...' : '업로드'}
      </button>
    </form>
  );
}
