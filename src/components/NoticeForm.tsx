// src/components/NoticeForm.tsx
'use client'

import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from './ImageUpload';
import { v4 as uuidv4 } from 'uuid'; // 파일명 생성을 위해 uuid 임포트

type Notice = {
  id?: number;
  title: string;
  category?: string;
  content: string;
  author_name?: string;
  image_urls?: string[];
  link_url?: string;
  is_published: boolean;
};

type FormInputs = Omit<Notice, 'image_urls'> & {
  imageFile_0?: FileList;
  imageFile_1?: FileList;
  imageFile_2?: FileList;
};

interface NoticeFormProps {
  initialData?: Notice;
}

export default function NoticeForm({ initialData }: NoticeFormProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormInputs>({
    defaultValues: initialData || {
      is_published: true,
      author_name: '관리자',
    },
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const isEditMode = !!initialData;

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    setMessage(null);

    try {
      const imageFiles: File[] = [];
      for (let i = 0; i < 3; i++) {
        const fileList = data[`imageFile_${i}` as keyof FormInputs] as FileList | undefined;
        if (fileList && fileList.length > 0) {
          imageFiles.push(fileList[0]);
        }
      }

      let uploadedImageUrls: string[] = initialData?.image_urls || [];

      // 새 이미지가 있으면 Presigned URL 방식으로 업로드
      if (imageFiles.length > 0) {
        const BUCKET_NAME = 'notice-images';
        const newImageUrls: string[] = [];

        for (const file of imageFiles) {
          const fileExtension = file.name.split('.').pop();
          const fileName = `${uuidv4()}.${fileExtension}`;
          const filePath = `${fileName}`; // 버킷 내 경로

          // 1. Presigned URL 요청 (공통 API 사용)
          const presignedUrlResponse = await fetch('/api/admin/generate-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bucketName: BUCKET_NAME, filePath: filePath }),
          });
          if (!presignedUrlResponse.ok) throw new Error('Presigned URL 생성 실패');
          const { presignedUrl, publicUrl } = await presignedUrlResponse.json();

          // 2. Presigned URL로 파일 직접 업로드
          const uploadResponse = await fetch(presignedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
          });
          if (!uploadResponse.ok) throw new Error('스토리지 업로드 실패');

          newImageUrls.push(publicUrl);
        }
        uploadedImageUrls = newImageUrls; // 새 이미지 URL로 교체
      }

      // 3. 최종 데이터를 JSON으로 서버에 전송
      const payload = {
        title: data.title,
        content: data.content,
        author_name: data.author_name || '관리자',
        is_published: data.is_published,
        category: data.category || '',
        link_url: data.link_url && !/^https?:\/\//i.test(data.link_url) ? `https://${data.link_url}` : data.link_url || null,
        image_urls: uploadedImageUrls
      };

      const url = isEditMode ? `/api/admin/notices/${initialData?.id}` : '/api/admin/notices';
      // 수정은 POST, 생성도 POST로 통일하여 API 단순화 (NoticeForm과 동일한 패턴)
      const method = 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'An error occurred');
      }

      setMessage({ type: 'success', text: `공지사항이 성공적으로 ${isEditMode ? '수정' : '생성'}되었습니다.` });
      if (!isEditMode) reset();

      router.refresh();
      setTimeout(() => router.push('/admin/notices'), 1500);

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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          대표 이미지 {isEditMode && '(변경할 경우에만 업로드)'}
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
          type="text"
          placeholder="example.com"
          {...register('link_url', {
            pattern: {
              value: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
              message: "올바른 URL 형식이 아닙니다."
            }
          })}
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
