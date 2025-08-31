// src/components/NewCrimeCaseForm.tsx
'use client'

import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from './ImageUpload';
import { v4 as uuidv4 } from 'uuid';

type NewCrimeCase = {
  id?: number;
  title: string;
  category?: string;
  method: string;
  image_urls?: string[];
  link_url?: string;
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

// ✅ URL 정규화/검증: 스킴 자동 보정 + URL 생성 가능 여부 체크
function normalizeUrl(input?: string): string {
  if (!input) return '';
  const s = String(input)
    .trim()
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '') // 제로폭 등 숨은 문자 제거
    .replace(/\s+/g, ''); // 공백 제거

  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    // http/https만 허용하고 싶다면 아래 라인으로 제한
    if (!['http:', 'https:'].includes(u.protocol)) return '';
    return u.toString();
  } catch {
    return '';
  }
}

export default function NewCrimeCaseForm({ initialData }: NewCrimeCaseFormProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormInputs>({
    defaultValues: initialData || { is_published: true },
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

      if (imageFiles.length > 0) {
        const BUCKET_NAME = 'post-images';
        const newImageUrls: string[] = [];

        for (const file of imageFiles) {
          const fileExtension = file.name.split('.').pop();
          const fileName = `${uuidv4()}.${fileExtension}`;
          const filePath = `new-crime-cases/${fileName}`;

          // 1) 업로드 URL 발급
          const presignedUrlResponse = await fetch('/api/admin/generate-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bucketName: BUCKET_NAME, filePath }),
          });

          if (!presignedUrlResponse.ok) {
            const error = await presignedUrlResponse.json();
            throw new Error(`Presigned URL 생성 실패: ${error.message}`);
          }
          const { presignedUrl, publicUrl } = await presignedUrlResponse.json();

          // 2) 업로드
          const uploadResponse = await fetch(presignedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
          });

          if (!uploadResponse.ok) {
            throw new Error(`스토리지 업로드 실패: ${uploadResponse.statusText}`);
          }
          newImageUrls.push(publicUrl);
        }
        uploadedImageUrls = newImageUrls;
      }

      // ✅ URL 정규화(스킴 자동 보정 포함)
      const linkUrlNormalized = data.link_url ? normalizeUrl(data.link_url) : '';

      // 3) 최종 전송 payload
      const payload = {
        title: data.title,
        method: data.method,
        is_published: data.is_published,
        category: data.category || '',
        link_url: linkUrlNormalized || null, // 빈 문자열이면 null 저장(선택)
        image_urls: uploadedImageUrls,
      };

      const url = isEditMode ? `/api/admin/new-crime-cases/${initialData?.id}` : '/api/admin/new-crime-cases';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

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
            validate: (v) => {
              if (!v) return true;              // 비워도 됨
              return !!normalizeUrl(v) || '올바른 URL 형식이 아닙니다.';
            },
          })}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
        />
        {errors.link_url && <p className="mt-1 text-sm text-red-600">{String(errors.link_url.message)}</p>}
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
