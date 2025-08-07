// src/components/ImageUpload.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
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


interface ImageUploadProps {
  register: UseFormRegister<any>;
  setValue: UseFormSetValue<any>;
  watch: UseFormWatch<any>;
  initialImageUrls?: string[];
}

export default function ImageUpload({ register, setValue, watch, initialImageUrls = [] }: ImageUploadProps) {
  const [previews, setPreviews] = useState<(string | null)[]>([null, null, null]);

  // [수정됨] 무한 루프를 방지하기 위해 watch 구독 모델로 변경합니다.
  useEffect(() => {
    // 1. 초기 이미지 설정 (컴포넌트 마운트 시 한 번만 실행)
    const initialPreviews: (string | null)[] = [null, null, null];
    initialImageUrls.slice(0, 3).forEach((url, index) => {
      initialPreviews[index] = url;
    });
    setPreviews(initialPreviews);

    // 2. 파일 필드의 변경을 '구독'합니다.
    const subscription = watch((value, { name }) => {
      // name이 'imageFile_0', 'imageFile_1', 'imageFile_2' 중 하나일 때만 실행
      if (name && name.startsWith('imageFile_')) {
        const index = parseInt(name.split('_')[1], 10);
        if (isNaN(index)) return;

        const fileList = value[name];
        setPreviews(currentPreviews => {
          const newPreviews = [...currentPreviews];
          const oldPreview = newPreviews[index];

          // 이전에 생성된 blob URL이 있다면 메모리에서 해제 (메모리 누수 방지)
          if (oldPreview && oldPreview.startsWith('blob:')) {
            URL.revokeObjectURL(oldPreview);
          }

          // 새 파일이 있으면 새로운 미리보기 URL을 생성하고, 없으면 초기 상태로 되돌립니다.
          if (fileList && fileList.length > 0) {
            newPreviews[index] = URL.createObjectURL(fileList[0]);
          } else {
            newPreviews[index] = initialImageUrls[index] || null;
          }
          return newPreviews;
        });
      }
    });

    // 3. 컴포넌트가 사라질 때 구독을 해제하고, 모든 blob URL을 메모리에서 해제합니다.
    return () => {
      subscription.unsubscribe();
      previews.forEach(p => {
        if (p && p.startsWith('blob:')) {
          URL.revokeObjectURL(p);
        }
      });
    };
  }, [watch, initialImageUrls]); // watch 함수와 initialImageUrls는 안정적이므로 이펙트는 거의 재실행되지 않습니다.


  const handleRemoveImage = (index: number) => {
    // 미리보기 상태 업데이트
    setPreviews(currentPreviews => {
      const newPreviews = [...currentPreviews];
      const oldPreview = newPreviews[index];
      if (oldPreview && oldPreview.startsWith('blob:')) {
        URL.revokeObjectURL(oldPreview);
      }
      newPreviews[index] = null;
      return newPreviews;
    });
    // react-hook-form의 파일 상태도 초기화
    setValue(`imageFile_${index}`, null, { shouldValidate: true });
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
                  {...register(`imageFile_${index}`)}
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
