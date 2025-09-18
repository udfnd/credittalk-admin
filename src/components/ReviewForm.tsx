// src/components/ReviewForm.tsx
'use client'

import { useForm, SubmitHandler, Path, PathValue } from 'react-hook-form';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from './ImageUpload';
import { v4 as uuidv4 } from 'uuid';

interface ReviewData {
  id?: number;
  title: string;
  content: string;
  rating: number;
  is_published: boolean;
  image_urls?: string[];
}

type ReviewInputs = {
  title: string;
  content: string;
  rating: number;
  is_published: boolean;
  imageFile_0?: FileList;
  imageFile_1?: FileList;
  imageFile_2?: FileList;
};

interface ReviewFormProps {
  initialData?: ReviewData;
}

async function uploadFile(file: File): Promise<string> {
  const BUCKET_NAME = 'reviews-images';
  const fileExtension = file.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExtension}`;

  const presignedUrlResponse = await fetch('/api/admin/generate-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketName: BUCKET_NAME, filePath: fileName }),
  });

  if (!presignedUrlResponse.ok) {
    const error = await presignedUrlResponse.json();
    throw new Error(`Presigned URL 생성 실패: ${error.message}`);
  }
  const { presignedUrl, publicUrl } = await presignedUrlResponse.json();

  const uploadResponse = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`스토리지 업로드 실패: ${uploadResponse.statusText}`);
  }

  return publicUrl;
}

export default function ReviewForm({ initialData }: ReviewFormProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<ReviewInputs>({
    defaultValues: initialData || {
      is_published: true,
      rating: 5,
    }
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previews, setPreviews] = useState<(string | null)[]>([null, null, null]);
  const isEditMode = !!initialData;

  useEffect(() => {
    const initialUrls = initialData?.image_urls || [];
    const newPreviews: (string | null)[] = [null, null, null];
    initialUrls.slice(0, 3).forEach((url, index) => {
      newPreviews[index] = url;
    });
    setPreviews(newPreviews);
  }, [initialData]);

  useEffect(() => {
    const subscription = watch((value, { name, type }) => {
      if (type !== 'change' || !name || !name.startsWith('imageFile_')) return;

      const index = parseInt(name.split('_')[1], 10);
      const fileList = value[name as keyof ReviewInputs] as FileList | undefined;

      setPreviews(currentPreviews => {
        const newPreviews = [...currentPreviews];
        const oldPreview = newPreviews[index];

        if (oldPreview && oldPreview.startsWith('blob:')) {
          URL.revokeObjectURL(oldPreview);
        }

        if (fileList && fileList.length > 0) {
          newPreviews[index] = URL.createObjectURL(fileList[0]);
        } else {
          newPreviews[index] = initialData?.image_urls?.[index] || null;
        }

        return newPreviews;
      });
    });
    return () => subscription.unsubscribe();
  }, [watch, initialData]);

  const handleRemoveImage = useCallback((index: number) => {
    const fieldName = `imageFile_${index}` as Path<ReviewInputs>;
    setValue(fieldName, undefined as PathValue<ReviewInputs, typeof fieldName>, { shouldValidate: true });

    setPreviews(currentPreviews => {
      const newPreviews = [...currentPreviews];
      const oldPreview = newPreviews[index];
      if (oldPreview && oldPreview.startsWith('blob:')) {
        URL.revokeObjectURL(oldPreview);
      }
      newPreviews[index] = null;
      return newPreviews;
    });
  }, [setValue]);

  const onSubmit: SubmitHandler<ReviewInputs> = async (data) => {
    setMessage(null);

    try {
      const finalImageUrls: string[] = [];
      const currentFiles = [data.imageFile_0, data.imageFile_1, data.imageFile_2];

      const uploadPromises = previews.map(async (preview, index) => {
        if (preview) {
          if (preview.startsWith('blob:')) {
            const fileList = currentFiles[index];
            if (fileList && fileList.length > 0) {
              return uploadFile(fileList[0]);
            }
          } else if (preview.startsWith('http')) {
            return preview;
          }
        }
        return null;
      });

      const results = await Promise.all(uploadPromises);
      finalImageUrls.push(...results.filter((url): url is string => url !== null));

      const payload = {
        title: data.title,
        content: data.content,
        rating: data.rating,
        is_published: data.is_published,
        image_urls: finalImageUrls,
      };

      const url = isEditMode ? `/api/admin/reviews/${initialData?.id}` : '/api/admin/reviews';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'An error occurred');
      }

      setMessage({ type: 'success', text: `후기가 성공적으로 ${isEditMode ? '수정' : '생성'}되었습니다.` });
      if (!isEditMode) {
        reset();
        setPreviews([null, null, null]);
      };

      router.refresh();
      setTimeout(() => router.push('/admin/reviews'), 1500);

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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          이미지 (최대 3장) {isEditMode && '(변경할 경우에만 업로드)'}
        </label>
        <ImageUpload
          register={register}
          previews={previews}
          onRemove={handleRemoveImage}
        />
      </div>
      <div>
        <label htmlFor="rating" className="block text-sm font-medium text-gray-700">평점</label>
        <select
          id="rating"
          {...register('rating', { required: true, valueAsNumber: true })}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
        >
          {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'⭐'.repeat(n)}</option>)}
        </select>
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
        {isSubmitting ? (isEditMode ? '수정 중...' : '생성 중...') : (isEditMode ? '수정하기' : '생성하기')}
      </button>
    </form>
  );
}
