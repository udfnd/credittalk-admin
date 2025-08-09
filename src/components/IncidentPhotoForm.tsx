// src/components/IncidentPhotoForm.tsx
'use client'

import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from './ImageUpload';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'; // [신규] Supabase 클라이언트 임포트
import { v4 as uuidv4 } from 'uuid'; // [신규] 파일명 생성을 위해 uuid 임포트

type IncidentPhoto = {
  id?: number;
  title: string;
  description?: string;
  category?: string;
  image_urls?: string[];
  link_url?: string;
  is_published: boolean;
};

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
  const supabase = createClientComponentClient(); // [신규] Supabase 클라이언트 초기화
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormInputs>({
    defaultValues: initialData || {
      is_published: true,
    }
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
          const filePath = `incident-photos/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file);

          if (uploadError) {
            throw new Error(`Storage Error: ${uploadError.message}`);
          }

          const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
          if(publicUrl) newImageUrls.push(publicUrl);
        }

        // 수정 모드일 경우 기존 이미지를 새 이미지로 교체, 생성 모드일 경우 그냥 할당
        uploadedImageUrls = isEditMode ? newImageUrls : newImageUrls;
      }

      if (!isEditMode && uploadedImageUrls.length === 0) {
        setMessage({ type: 'error', text: '새로운 자료에는 이미지 파일이 필수입니다.' });
        return;
      }

      // [수정됨] 이제 FormData 대신 JSON으로 서버에 데이터를 전송합니다.
      const payload = {
        title: data.title,
        description: data.description || '',
        category: data.category || '',
        is_published: data.is_published,
        link_url: data.link_url || '',
        image_urls: uploadedImageUrls,
        // 수정 모드일 때, 기존 이미지 URL을 보내서 서버가 어떤 파일을 삭제해야 할지 알게 함
        existing_image_urls: isEditMode ? initialData?.image_urls : undefined,
      };

      const url = isEditMode ? `/api/admin/incident-photos/${initialData?.id}` : '/api/admin/incident-photos';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

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
