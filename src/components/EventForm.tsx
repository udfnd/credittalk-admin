'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/supabase/client';

interface EventFormData {
  title: string;
  description: string;
  entry_start_at: string;
  entry_end_at: string;
  winner_announce_at: string;
  winner_count: number;
}

interface Props {
  eventId?: string;
}

// 날짜 기반으로 상태와 공개 여부를 자동 계산
function calculateStatusAndPublished(
  entryStartAt: string,
  entryEndAt: string,
  winnerAnnounceAt: string
): { status: string; is_published: boolean } {
  const now = new Date();
  const startDate = new Date(entryStartAt);
  const endDate = new Date(entryEndAt);
  const announceDate = new Date(winnerAnnounceAt);

  if (now < startDate) {
    // 응모 시작 전
    return { status: 'draft', is_published: false };
  } else if (now >= startDate && now < endDate) {
    // 응모 진행 중
    return { status: 'active', is_published: true };
  } else if (now >= endDate && now < announceDate) {
    // 응모 마감, 발표 전
    return { status: 'closed', is_published: true };
  } else {
    // 발표일 이후
    return { status: 'announced', is_published: true };
  }
}

// Presigned URL을 사용한 이미지 업로드
async function uploadFile(file: File): Promise<string> {
  const BUCKET_NAME = 'events-images';
  const fileExtension = file.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExtension}`;
  const filePath = `${fileName}`;

  const presignedUrlResponse = await fetch('/api/admin/generate-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketName: BUCKET_NAME, filePath }),
  });
  if (!presignedUrlResponse.ok) throw new Error('Presigned URL 생성 실패');
  const { presignedUrl, publicUrl } = await presignedUrlResponse.json();

  const uploadResponse = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!uploadResponse.ok) throw new Error('스토리지 업로드 실패');

  return publicUrl;
}

export default function EventForm({ eventId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const isEdit = !!eventId;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<EventFormData>({
    defaultValues: {
      title: '',
      description: '',
      entry_start_at: '',
      entry_end_at: '',
      winner_announce_at: '',
      winner_count: 1,
    },
  });

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) throw error;
      if (data) {
        setValue('title', data.title);
        setValue('description', data.description);
        setValue('winner_count', data.winner_count);
        setValue(
          'entry_start_at',
          formatDateTimeLocal(data.entry_start_at)
        );
        setValue('entry_end_at', formatDateTimeLocal(data.entry_end_at));
        setValue(
          'winner_announce_at',
          formatDateTimeLocal(data.winner_announce_at)
        );
        if (data.image_url) {
          setImageUrl(data.image_url);
          setPreviewUrl(data.image_url);
        }
      }
    } catch (err) {
      alert('이벤트 로드 실패: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    }
  };

  const formatDateTimeLocal = (isoString: string) => {
    const date = new Date(isoString);
    return date.toISOString().slice(0, 16);
  };

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleImageClear = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setImageFile(null);
    setPreviewUrl(imageUrl); // 기존 이미지로 복원
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return imageUrl || null;
    return uploadFile(imageFile);
  };

  const onSubmit = async (data: EventFormData) => {
    setLoading(true);
    try {
      // 이미지 업로드
      const uploadedImageUrl = await uploadImage();

      // 날짜 기반으로 상태와 공개 여부 자동 계산
      const { status, is_published } = calculateStatusAndPublished(
        data.entry_start_at,
        data.entry_end_at,
        data.winner_announce_at
      );

      const eventData = {
        title: data.title,
        description: data.description,
        image_url: uploadedImageUrl,
        entry_start_at: new Date(data.entry_start_at).toISOString(),
        entry_end_at: new Date(data.entry_end_at).toISOString(),
        winner_announce_at: new Date(data.winner_announce_at).toISOString(),
        winner_count: data.winner_count,
        status,
        is_published,
        updated_at: new Date().toISOString(),
      };

      if (isEdit) {
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', eventId);
        if (error) throw error;
        alert('이벤트가 수정되었습니다.');
      } else {
        const { error } = await supabase.from('events').insert(eventData);
        if (error) throw error;
        alert('이벤트가 생성되었습니다.');
      }

      router.push('/admin/events');
    } catch (err) {
      alert('저장 실패: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      {/* 제목 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          제목 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register('title', { required: '제목을 입력해주세요.' })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="이벤트 제목"
        />
        {errors.title && (
          <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
        )}
      </div>

      {/* 설명 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          설명 <span className="text-red-500">*</span>
        </label>
        <textarea
          {...register('description', { required: '설명을 입력해주세요.' })}
          rows={6}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="이벤트 상세 설명"
        />
        {errors.description && (
          <p className="text-red-500 text-sm mt-1">
            {errors.description.message}
          </p>
        )}
      </div>

      {/* 이미지 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          대표 이미지
        </label>
        <div className="space-y-2">
          {previewUrl && (
            <div className="relative inline-block">
              {previewUrl.startsWith('blob:') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-xs rounded-lg border"
                />
              ) : (
                <Image
                  src={previewUrl}
                  alt="Preview"
                  width={320}
                  height={240}
                  className="max-w-xs rounded-lg border object-cover"
                  unoptimized
                />
              )}
              <button
                type="button"
                onClick={handleImageClear}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
              >
                ×
              </button>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageSelect(file);
            }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
      </div>

      {/* 응모 기간 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            응모 시작일 <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            {...register('entry_start_at', {
              required: '응모 시작일을 선택해주세요.',
            })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            응모 마감일 <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            {...register('entry_end_at', {
              required: '응모 마감일을 선택해주세요.',
            })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* 당첨 발표일 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          당첨자 발표일 <span className="text-red-500">*</span>
        </label>
        <input
          type="datetime-local"
          {...register('winner_announce_at', {
            required: '발표일을 선택해주세요.',
          })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* 당첨 인원 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          당첨 인원 <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min="1"
          {...register('winner_count', {
            required: '당첨 인원을 입력해주세요.',
            min: { value: 1, message: '최소 1명 이상이어야 합니다.' },
          })}
          className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <span className="ml-2 text-gray-600">명</span>
      </div>

      {/* 안내 문구 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          💡 <strong>상태 및 공개 여부는 날짜에 따라 자동으로 결정됩니다:</strong>
        </p>
        <ul className="text-sm text-blue-600 mt-2 space-y-1">
          <li>• 응모 시작 전: 초안 (비공개)</li>
          <li>• 응모 진행 중: 진행중 (공개)</li>
          <li>• 응모 마감 후 ~ 발표 전: 마감 (공개)</li>
          <li>• 발표일 이후: 발표완료 (공개)</li>
        </ul>
      </div>

      {/* 버튼 */}
      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {loading ? '저장 중...' : isEdit ? '수정하기' : '생성하기'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/events')}
          className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition"
        >
          취소
        </button>
      </div>
    </form>
  );
}
