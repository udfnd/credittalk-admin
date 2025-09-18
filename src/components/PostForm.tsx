// src/components/PostForm.tsx
'use client'

import { useForm, SubmitHandler, Path, PathValue } from 'react-hook-form';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from './ImageUpload';
import { v4 as uuidv4 } from 'uuid';

interface PostData {
  id?: number;
  title: string;
  content: string;
  category: string;
  link_url?: string;
  image_urls?: string[];
}

type FormInputs = Omit<PostData, 'image_urls'> & {
  imageFile_0?: FileList;
  imageFile_1?: FileList;
  imageFile_2?: FileList;
};

interface PostFormProps {
  initialData?: PostData;
}

function normalizeUrl(raw?: string | null): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s) return '';
  const withScheme = /^[a-z][a-z0-9+\-.]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (!['http:', 'https:'].includes(u.protocol)) return '';
    return u.toString();
  } catch {
    return '';
  }
}

async function uploadFile(file: File): Promise<string> {
  const BUCKET_NAME = 'post-images';
  const fileExtension = file.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExtension}`;
  const filePath = `community-posts/${fileName}`;

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

export default function PostForm({ initialData }: PostFormProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormInputs>({
    defaultValues: initialData || {},
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
      const fileList = value[name as keyof FormInputs] as FileList | undefined;

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
    const fieldName = `imageFile_${index}` as Path<FormInputs>;
    setValue(fieldName, undefined as PathValue<FormInputs, typeof fieldName>, { shouldValidate: true });

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

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
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

      const normalizedLink = data.link_url ? normalizeUrl(data.link_url) : '';

      const payload = {
        title: data.title,
        content: data.content,
        category: data.category,
        link_url: normalizedLink || null,
        image_urls: finalImageUrls,
      };

      const url = isEditMode ? `/api/admin/posts/${initialData?.id}` : '/api/admin/posts';
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

      setMessage({ type: 'success', text: `게시글이 성공적으로 ${isEditMode ? '수정' : '생성'}되었습니다.` });
      if (!isEditMode) {
        reset();
        setPreviews([null, null, null]);
      };

      router.refresh();
      setTimeout(() => router.push('/admin/posts'), 1500);

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
          {...register('category', { required: '카테고리는 필수입니다.' })}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
          placeholder="(카테고리를 적어주세요. #소식공유 #검거완료 #신종범죄)"
        />
        {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>}
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700">내용</label>
        <textarea
          id="content"
          rows={10}
          {...register('content')}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          이미지 (최대 3장, 선택 사항)
        </label>
        <ImageUpload
          register={register}
          previews={previews}
          onRemove={handleRemoveImage}
        />
      </div>

      <div>
        <label htmlFor="link_url" className="block text-sm font-medium text-gray-700">링크 URL (선택 사항)</label>
        <input
          id="link_url"
          type="text"
          placeholder="예: youtube.com/..., instagram.com/..., tiktok.com/..."
          {...register('link_url', {
            validate: (v) => {
              if (!v) return true;
              return normalizeUrl(v) ? true : '올바른 URL 형식이 아닙니다.';
            }
          })}
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
        />
        {errors.link_url && <p className="mt-1 text-sm text-red-600">{errors.link_url.message}</p>}
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
