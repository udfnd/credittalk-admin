// src/components/NoticeForm.tsx
'use client'

import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Notice = {
  id?: number;
  title: string;
  content: string;
  author_name?: string;
  image_url?: string;
  link_url?: string;
  is_published: boolean;
};

type FormInputs = Notice & {
  imageFile?: FileList;
};

interface NoticeFormProps {
  initialData?: Notice;
}

export default function NoticeForm({ initialData }: NoticeFormProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormInputs>({
    defaultValues: initialData || {
      is_published: true,
      author_name: '관리자',
    },
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isEditMode = !!initialData;

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    setMessage(null);
    const formData = new FormData();

    formData.append('title', data.title);
    formData.append('content', data.content);
    formData.append('link_url', data.link_url || '');
    formData.append('author_name', data.author_name || '관리자');
    formData.append('is_published', String(data.is_published));
    if (data.imageFile && data.imageFile.length > 0) {
      formData.append('imageFile', data.imageFile[0]);
    }

    const url = isEditMode ? `/api/admin/notices/${initialData.id}` : '/api/admin/notices';
    const method = 'POST'; // 생성 및 수정 모두 POST 사용 (FormData)

    try {
      const response = await fetch(url, { method, body: formData });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'An error occurred');
      }

      setMessage({ type: 'success', text: `공지사항이 성공적으로 ${isEditMode ? '수정' : '생성'}되었습니다.` });

      if (!isEditMode) {
        reset();
      }

      router.refresh();
      if (isEditMode) {
        setTimeout(() => router.push('/admin/notices'), 1500);
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
        <label htmlFor="content" className="block text-sm font-medium text-gray-700">내용</label>
        <textarea
          id="content"
          rows={10}
          {...register('content', { required: '내용은 필수입니다.' })}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
        />
        {errors.content && <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>}
      </div>

      <div>
        <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700">
          대표 이미지 {isEditMode && '(변경할 경우에만 업로드)'}
        </label>
        <input
          id="imageFile"
          type="file"
          accept="image/*"
          {...register('imageFile', { required: isEditMode ? false : '새 글에는 이미지가 필수입니다.' })}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
        {errors.imageFile && <p className="mt-1 text-sm text-red-600">{errors.imageFile.message}</p>}
        {initialData?.image_url && (
          <div className="mt-2">
            <p className="text-sm text-gray-600">현재 이미지:</p>
            <img src={initialData.image_url} alt={initialData.title} className="max-w-xs mt-1 rounded"/>
          </div>
        )}
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

      <div>
        <label htmlFor="author_name" className="block text-sm font-medium text-gray-700">작성자</label>
        <input
          id="author_name"
          {...register('author_name')}
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
