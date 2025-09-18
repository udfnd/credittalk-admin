// src/components/ImageUpload.tsx
'use client';

import React from 'react';
import { UseFormRegister, FieldValues, Path } from 'react-hook-form';
import Image from 'next/image';

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const XCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

interface ImageUploadProps<T extends FieldValues> {
  register: UseFormRegister<T>;
  previews: (string | null)[];
  onRemove: (index: number) => void;
}

export default function ImageUpload<T extends FieldValues>({
                                                             register,
                                                             previews,
                                                             onRemove,
                                                           }: ImageUploadProps<T>) {
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
                  onClick={() => onRemove(index)}
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
