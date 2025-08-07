// src/components/ImageUpload.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { UseFormRegister, UseFormSetValue, UseFormWatch, FieldValues, Path, PathValue } from 'react-hook-form';
import Image from 'next/image';

// + 아이콘 SVG
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

// 삭제 아이콘 SVG
const XCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// 제네릭 T를 사용하여 어떤 폼에서든 재사용 가능하도록 타입을 정의합니다.
interface ImageUploadProps<T extends FieldValues> {
  register: UseFormRegister<T>;
  setValue: UseFormSetValue<T>;
  watch: UseFormWatch<T>;
  initialImageUrls?: string[];
}

export default function ImageUpload<T extends FieldValues>({ register, setValue, watch, initialImageUrls = [] }: ImageUploadProps<T>) {
  const [previews, setPreviews] = useState<(string | null)[]>([null, null, null]);

  useEffect(() => {
    const initialPreviews: (string | null)[] = [null, null, null];
    initialImageUrls.slice(0, 3).forEach((url, index) => {
      initialPreviews[index] = url;
    });
    setPreviews(initialPreviews);
  }, [initialImageUrls]);

  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name && (name === 'imageFile_0' || name === 'imageFile_1' || name === 'imageFile_2')) {
        const index = parseInt(name.split('_')[1], 10);
        if (isNaN(index)) return;

        const fileList = value[name] as FileList | undefined;
        setPreviews(currentPreviews => {
          const newPreviews = [...currentPreviews];
          const oldPreview = newPreviews[index];

          if (oldPreview && oldPreview.startsWith('blob:')) {
            URL.revokeObjectURL(oldPreview);
          }

          if (fileList && fileList.length > 0) {
            newPreviews[index] = URL.createObjectURL(fileList[0]);
          } else {
            newPreviews[index] = initialImageUrls[index] || null;
          }
          return newPreviews;
        });
      }
    });

    return () => {
      subscription.unsubscribe();
      previews.forEach(p => {
        if (p && p.startsWith('blob:')) {
          URL.revokeObjectURL(p);
        }
      });
    };
  }, [watch, initialImageUrls]);


  const handleRemoveImage = (index: number) => {
    setPreviews(currentPreviews => {
      const newPreviews = [...currentPreviews];
      const oldPreview = newPreviews[index];
      if (oldPreview && oldPreview.startsWith('blob:')) {
        URL.revokeObjectURL(oldPreview);
      }
      newPreviews[index] = null;
      return newPreviews;
    });

    // [수정됨] 타입 단언을 통해 TypeScript에 `fieldName`이 T의 유효한 키임을 알려줍니다.
    const fieldName = `imageFile_${index}` as Path<T>;
    // [수정됨] `undefined`를 PathValue 타입으로 단언하여 타입 불일치 문제를 해결합니다.
    setValue(fieldName, undefined as PathValue<T, Path<T>>, { shouldValidate: true });
  };

  return (
    <div>
      <div className="flex flex-wrap gap-4">
        {[0, 1, 2].map(index => (
          <div key={index} className="w-32 h-32 border-2 border-dashed rounded-lg flex justify-center items-center relative bg-gray-50">
            {previews[index] ? (
              <>
                <Image src={previews[index]!} alt={`Preview ${index + 1}`} layout="fill" objectFit="cover" className="rounded-lg" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="absolute -top-2 -right-2 bg-white rounded-full text-red-500 hover:text-red-700 transition-transform transform hover:scale-110"
                >
                  <XCircleIcon />
                </button>
              </>
            ) : (
              <label htmlFor={`imageFile_${index}`} className="cursor-pointer p-4">
                <PlusIcon />
                <input
                  id={`imageFile_${index}`}
                  type="file"
                  accept="image/*"
                  // [수정됨] 타입 단언을 사용하여 TypeScript에 `fieldName`이 T의 유효한 키임을 알려줍니다.
                  {...register(`imageFile_${index}` as Path<T>)}
                  className="hidden"
                />
              </label>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500">이미지는 최대 3개까지 업로드할 수 있습니다.</p>
    </div>
  );
}
