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
  max_entry_count: number | null;
}

interface Props {
  eventId?: string;
}

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
    return { status: 'draft', is_published: false };
  } else if (now >= startDate && now < endDate) {
    return { status: 'active', is_published: true };
  } else if (now >= endDate && now < announceDate) {
    return { status: 'closed', is_published: true };
  } else {
    return { status: 'announced', is_published: true };
  }
}

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

  // 다중 이미지 상태
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const isEdit = !!eventId;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EventFormData>({
    defaultValues: {
      title: '',
      description: '',
      entry_start_at: '',
      entry_end_at: '',
      winner_announce_at: '',
      winner_count: 1,
      max_entry_count: null,
    },
  });

  const [hasMaxEntry, setHasMaxEntry] = useState(false);

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
        setValue('entry_start_at', formatDateTimeLocal(data.entry_start_at));
        setValue('entry_end_at', formatDateTimeLocal(data.entry_end_at));
        setValue('winner_announce_at', formatDateTimeLocal(data.winner_announce_at));

        // 최대 응모 인원 로드
        if (data.max_entry_count !== null) {
          setHasMaxEntry(true);
          setValue('max_entry_count', data.max_entry_count);
        }

        // 기존 이미지 URL 로드 (image_urls 배열 또는 image_url)
        let existingUrls: string[] = [];
        if (data.image_urls && data.image_urls.length > 0) {
          existingUrls = data.image_urls;
        } else if (data.image_url) {
          existingUrls = [data.image_url];
        }
        setImageUrls(existingUrls);
        setPreviewUrls(existingUrls);
      }
    } catch (err) {
      alert('이벤트 로드 실패: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    }
  };

  const formatDateTimeLocal = (isoString: string) => {
    const date = new Date(isoString);
    return date.toISOString().slice(0, 16);
  };

  // 다중 이미지 선택
  const handleImagesSelect = (files: FileList | null) => {
    if (!files) return;

    const newFiles = Array.from(files);
    setNewImageFiles(prev => [...prev, ...newFiles]);

    // 미리보기 URL 생성
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...newPreviews]);
  };

  // 이미지 제거
  const handleImageRemove = (index: number) => {
    const url = previewUrls[index];

    // blob URL이면 revoke
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      // newImageFiles에서도 제거 (blob URL 인덱스 계산)
      const blobIndex = previewUrls.slice(0, index).filter(u => u.startsWith('blob:')).length;
      setNewImageFiles(prev => prev.filter((_, i) => i !== blobIndex));
    } else {
      // 기존 URL이면 imageUrls에서 제거
      setImageUrls(prev => prev.filter(u => u !== url));
    }

    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // 이미지 업로드 및 URL 배열 반환
  const uploadImages = async (): Promise<string[]> => {
    // 새 파일들 업로드
    const uploadedUrls = await Promise.all(
      newImageFiles.map(file => uploadFile(file))
    );

    // 기존 URL + 새로 업로드된 URL
    return [...imageUrls, ...uploadedUrls];
  };

  const onSubmit = async (data: EventFormData) => {
    setLoading(true);
    try {
      // 이미지 업로드
      const uploadedImageUrls = await uploadImages();

      const { status, is_published } = calculateStatusAndPublished(
        data.entry_start_at,
        data.entry_end_at,
        data.winner_announce_at
      );

      const eventData = {
        title: data.title,
        description: data.description,
        image_url: uploadedImageUrls[0] || null, // 첫 번째 이미지 (하위 호환성)
        image_urls: uploadedImageUrls, // 전체 이미지 배열
        entry_start_at: new Date(data.entry_start_at).toISOString(),
        entry_end_at: new Date(data.entry_end_at).toISOString(),
        winner_announce_at: new Date(data.winner_announce_at).toISOString(),
        winner_count: data.winner_count,
        max_entry_count: hasMaxEntry ? data.max_entry_count : null,
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

      {/* 다중 이미지 업로드 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          이벤트 이미지 (여러 장 가능)
        </label>
        <div className="space-y-4">
          {/* 이미지 미리보기 그리드 */}
          {previewUrls.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {previewUrls.map((url, index) => (
                <div key={index} className="relative group">
                  {url.startsWith('blob:') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                  ) : (
                    <Image
                      src={url}
                      alt={`Preview ${index + 1}`}
                      width={200}
                      height={160}
                      className="w-full h-40 object-cover rounded-lg border"
                      unoptimized
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => handleImageRemove(index)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                  {index === 0 && (
                    <span className="absolute bottom-2 left-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded">
                      대표 이미지
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 파일 선택 */}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleImagesSelect(e.target.files)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <p className="text-sm text-gray-500">
            여러 장의 이미지를 선택할 수 있습니다. 첫 번째 이미지가 대표 이미지로 사용됩니다.
          </p>
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

      {/* 당첨 인원 & 응모 인원 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            당첨 인원 <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center">
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
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            응모 인원 제한
          </label>
          <div className="flex items-center gap-3">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hasMaxEntry}
                onChange={(e) => {
                  setHasMaxEntry(e.target.checked);
                  if (!e.target.checked) {
                    setValue('max_entry_count', null);
                  }
                }}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm text-gray-600">제한 설정</span>
            </label>
            {hasMaxEntry && (
              <div className="flex items-center">
                <input
                  type="number"
                  min="1"
                  {...register('max_entry_count', {
                    min: { value: 1, message: '최소 1명 이상이어야 합니다.' },
                  })}
                  className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="제한 없음"
                />
                <span className="ml-2 text-gray-600">명</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {hasMaxEntry
              ? '설정한 인원이 응모하면 응모가 마감됩니다.'
              : '체크하면 최대 응모 가능 인원을 설정할 수 있습니다.'}
          </p>
        </div>
      </div>

      {/* 안내 문구 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          <strong>상태 및 공개 여부는 날짜에 따라 자동으로 결정됩니다:</strong>
        </p>
        <ul className="text-sm text-blue-600 mt-2 space-y-1">
          <li>• 응모 시작 전: 초안 (비공개)</li>
          <li>• 응모 진행 중: 진행중 (공개)</li>
          <li>• 응모 마감 후 ~ 발표 전: 마감 (공개)</li>
          <li>• 발표일 이후: 발표완료 (공개)</li>
        </ul>
        {hasMaxEntry && (
          <p className="text-sm text-orange-600 mt-3">
            <strong>응모 인원 제한:</strong> 설정한 인원이 모두 응모하면 &apos;인원 마감&apos; 상태가 됩니다.
            이후 응모 시도한 사용자에게는 다음 이벤트 우선권이 부여됩니다.
          </p>
        )}
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
