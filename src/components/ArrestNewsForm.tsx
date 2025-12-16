// src/components/ArrestNewsForm.tsx
'use client';

import { useForm, SubmitHandler, Path, PathValue } from 'react-hook-form';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from './ImageUpload';
import { v4 as uuidv4 } from 'uuid';

const FRAUD_CATEGORIES = [
  '보이스피싱, 전기통신금융사기, 로맨스 스캠 사기',
  '불법사금융',
  '중고물품 사기',
  '알바 사기',
  '부동산 사기 (전, 월세 사기)',
  '암호화폐',
  '기타',
];

const POLICE_STATION_OPTIONS = [
  '서울중부경찰서', '서울종로경찰서', '서울남대문경찰서', '서울서대문경찰서', '서울혜화경찰서',
  '서울용산경찰서', '서울성북경찰서', '서울동대문경찰서', '서울마포경찰서', '서울영등포경찰서',
  '서울성동경찰서', '서울동작경찰서', '서울광진경찰서', '서울서부경찰서', '서울강북경찰서',
  '서울금천경찰서', '서울중랑경찰서', '서울강남경찰서', '서울관악경찰서', '서울강서경찰서',
  '서울강동경찰서', '서울종암경찰서', '서울구로경찰서', '서울서초경찰서', '서울양천경찰서',
  '서울송파경찰서', '서울노원경찰서', '서울방배경찰서', '서울은평경찰서', '서울도봉경찰서',
  '서울수서경찰서', '부산중부경찰서', '부산동래경찰서', '부산영도경찰서', '부산동부경찰서',
  '부산진경찰서', '부산서부경찰서', '부산남부경찰서', '부산해운대경찰서', '부산사상경찰서',
  '부산금정경찰서', '부산사하경찰서', '부산연제경찰서', '부산강서경찰서', '부산북부경찰서',
  '부산기장경찰서', '대구중부경찰서', '대구동부경찰서', '대구서부경찰서', '대구남부경찰서',
  '대구북부경찰서', '대구수성경찰서', '대구달서경찰서', '대구성서경찰서', '대구달성경찰서',
  '대구강북경찰서', '인천중부', '인천미추홀경찰서', '인천남동경찰서', '인천논현경찰서',
  '인천부평경찰서', '인천삼산경찰서', '인천서부경찰서', '인천계양경찰서', '인천연수경찰서',
  '인천강화경찰서', '광주동부경찰서', '광주서부경찰서', '광주남부경찰서', '광주북부경찰서',
  '광주광산경찰서', '대전중부경찰서', '대전동부경찰서', '대전서부경찰서', '대전대덕경찰서',
  '대전둔산경찰서', '대전유성경찰서', '울산중부경찰서', '울산남부경찰서', '울산동부경찰서',
  '울산북부경찰서', '울산울주경찰서', '세종남부경찰서', '세종북부경찰서', '수원중부경찰서',
  '수원남부경찰서', '수원서부경찰서', '안양동안경찰서', '안양만안경찰서', '과천경찰서',
  '군포경찰서', '성남수정경찰서', '성남중원경찰서', '분당경찰서', '부천소사경찰서',
  '부천원미경찰서', '부천오정경찰서', '광명경찰서', '안산단원경찰서', '안산상록경찰서',
  '시흥경찰서', '평택경찰서', '오산경찰서', '화성서부경찰서', '화성동탄경찰서',
  '용인동부경찰서', '용인서부경찰서', '광주의왕경찰서', '의왕경찰서', '하남경찰서',
  '이천경찰서', '김포경찰서', '안성경찰서', '여주경찰서', '양평경찰서',
  '의정부경찰서', '양주경찰서', '고양경찰서', '일산동부경찰서', '일산서부경찰서',
  '남양주남부경찰서', '남양주북부경찰서', '구리경찰서', '동두천경찰서', '파주경찰서',
  '포천경찰서', '가평경찰서', '연천경찰서', '춘천경찰서', '강릉경찰서',
  '원주경찰서', '동해경찰서', '태백경찰서', '속초경찰서', '삼척경찰서',
  '영월경찰서', '정선경찰서', '홍천경찰서', '평창경찰서', '횡성경찰서',
  '고성경찰서', '인제경찰서', '철원경찰서', '화천경찰서', '양구경찰서',
  '청주흥덕경찰서', '청주상당경찰서', '청주청원경찰서', '충주경찰서', '제천경찰서',
  '영동경찰서', '괴산경찰서', '단양경찰서', '보은경찰서', '옥천경찰서',
  '음성경찰서', '진천경찰서', '천안서북경찰서', '천안동남경찰서', '서산경찰서',
  '논산경찰서', '아산경찰서', '공주경찰서', '보령경찰서', '당진경찰서',
  '홍성경찰서', '예산경찰서', '부여경찰서', '서천경찰서', '금산경찰서',
  '청양경찰서', '태안경찰서', '전주완산경찰서', '전주덕진경찰서', '군산경찰서',
  '익산경찰서', '정읍경찰서', '남원경찰서', '김제경찰서', '완주경찰서',
  '고창경찰서', '부안경찰서', '임실경찰서', '순창경찰서', '진안경찰서',
  '장수경찰서', '무주경찰서', '목포경찰서', '여수경찰서', '순천경찰서',
  '나주경찰서', '광양경찰서', '고흥경찰서', '해남경찰서', '장흥경찰서',
  '보성경찰서', '영광경찰서', '화순경찰서', '함평경찰서', '영암경찰서',
  '장성경찰서', '강진경찰서', '담양경찰서', '곡성경찰서', '완도경찰서',
  '무안경찰서', '진도경찰서', '구례경찰서', '신안경찰서', '경주경찰서',
  '포항북부경찰서', '포항남부경찰서', '구미경찰서', '경산경찰서', '안동경찰서',
  '김천경찰서', '영주경찰서', '영천경찰서', '상주경찰서', '문경경찰서',
  '칠곡경찰서', '의성경찰서', '청도경찰서', '영덕경찰서', '울진경찰서',
  '봉화경찰서', '예천경찰서', '성주경찰서', '청송경찰서', '영양경찰서',
  '군위경찰서', '고령경찰서', '울릉경찰서', '창원중부경찰서', '창원서부경찰서',
  '마산중부경찰서', '마산동부경찰서', '진주경찰서', '김해중부경찰서', '김해서부경찰서',
  '진해경찰서', '통영경찰서', '사천경찰서', '거제경찰서', '밀양경찰서',
  '양산경찰서', '거창경찰서', '합천경찰서', '창녕경찰서', '하동경찰서',
  '남해경찰서', '함양경찰서', '산청경찰서', '함안경찰서', '의령경찰서',
  '제주동부경찰서', '제주서부경찰서', '서귀포경찰서',
];

type ArrestNews = {
  id?: number;
  title: string;
  category?: string;
  content?: string;
  author_name?: string;
  image_urls?: string[];
  link_url?: string;
  is_published: boolean;
  arrest_status?: 'arrested' | 'active' | null;
  reported_to_police?: boolean | null;
  police_station_name?: string | null;
  fraud_category?: string | null;
  scammer_nickname?: string | null;
  scammer_account_number?: string | null;
  scammer_phone_number?: string | null;
};

type FormInputs = Omit<ArrestNews, 'image_urls'> & {
  imageFile_0?: FileList;
  imageFile_1?: FileList;
  imageFile_2?: FileList;
  custom_fraud_category?: string;
};

interface ArrestNewsFormProps {
  initialData?: ArrestNews;
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
  const BUCKET_NAME = 'arrest-news-images';
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

export default function ArrestNewsForm({ initialData }: ArrestNewsFormProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormInputs>({
    defaultValues: initialData ? {
      ...initialData,
      custom_fraud_category: initialData.fraud_category && !FRAUD_CATEGORIES.includes(initialData.fraud_category)
        ? initialData.fraud_category
        : '',
      fraud_category: initialData.fraud_category && FRAUD_CATEGORIES.includes(initialData.fraud_category)
        ? initialData.fraud_category
        : initialData.fraud_category && !FRAUD_CATEGORIES.includes(initialData.fraud_category)
          ? '기타'
          : initialData.fraud_category,
    } : {
      is_published: true,
      author_name: '관리자',
      arrest_status: null,
      reported_to_police: null,
      police_station_name: null,
      fraud_category: null,
      scammer_nickname: null,
      scammer_account_number: null,
      scammer_phone_number: null,
    },
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previews, setPreviews] = useState<(string | null)[]>([null, null, null]);
  const [policeSearch, setPoliceSearch] = useState(initialData?.police_station_name || '');
  const isEditMode = !!initialData;

  const reportedToPolice = watch('reported_to_police');
  const fraudCategory = watch('fraud_category');

  const filteredStations = useMemo(() => {
    if (!policeSearch.trim()) return POLICE_STATION_OPTIONS;
    const keyword = policeSearch.trim().toLowerCase();
    return POLICE_STATION_OPTIONS.filter(name => name.toLowerCase().includes(keyword));
  }, [policeSearch]);

  useEffect(() => {
    if (reportedToPolice !== true) {
      setValue('police_station_name', null);
      setPoliceSearch('');
    }
  }, [reportedToPolice, setValue]);

  // Set initial previews from initialData. This runs only once.
  useEffect(() => {
    const initialUrls = initialData?.image_urls || [];
    const newPreviews: (string | null)[] = [null, null, null];
    initialUrls.slice(0, 3).forEach((url, index) => {
      newPreviews[index] = url;
    });
    setPreviews(newPreviews);
  }, [initialData]);

  // Watch for file input changes and update previews
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
          // If the file input is cleared, revert to the initial URL if it exists
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

      const finalFraudCategory = data.fraud_category === '기타'
        ? (data.custom_fraud_category?.trim() || null)
        : (data.fraud_category || null);

      const payload = {
        title: data.title,
        content: data.content || '',
        author_name: data.author_name || '관리자',
        is_published: data.is_published,
        category: data.category || '',
        link_url: normalizedLink || null,
        image_urls: finalImageUrls,
        arrest_status: data.arrest_status || null,
        reported_to_police: data.reported_to_police ?? null,
        police_station_name: data.reported_to_police ? data.police_station_name : null,
        fraud_category: finalFraudCategory,
        scammer_nickname: data.scammer_nickname?.trim() || null,
        scammer_account_number: data.scammer_account_number?.trim() || null,
        scammer_phone_number: data.scammer_phone_number?.trim() || null,
      };

      const url = isEditMode ? `/api/admin/arrest-news/${initialData?.id}` : '/api/admin/arrest-news';
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

      setMessage({ type: 'success', text: `성공적으로 ${isEditMode ? '수정' : '생성'}되었습니다.` });
      if (!isEditMode) {
        reset();
        setPreviews([null, null, null]);
      }

      router.refresh();
      setTimeout(() => {
        if (isEditMode) {
          router.push('/admin/arrest-news');
        }
      }, 1500);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setMessage({ type: 'error', text: errorMessage });
    }
  };


  const arrestStatus = watch('arrest_status');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 bg-white rounded-lg shadow-md space-y-4">
      {message && <div className={`p-3 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</div>}

      {/* 검거/활동 상태 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">검거/활동 상태</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setValue('arrest_status', 'arrested')}
            className={`flex-1 py-2 px-4 rounded-md border font-medium transition-colors ${
              arrestStatus === 'arrested'
                ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            검거
          </button>
          <button
            type="button"
            onClick={() => setValue('arrest_status', 'active')}
            className={`flex-1 py-2 px-4 rounded-md border font-medium transition-colors ${
              arrestStatus === 'active'
                ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            활동
          </button>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          <p>- 검거: 해당 범죄자가 이미 검거됨</p>
          <p>- 활동: 해당 범죄자가 검거되지 않고 활동 중임</p>
        </div>
      </div>

      {/* 경찰 신고 여부 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">경찰에 신고하셨습니까?</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setValue('reported_to_police', true)}
            className={`flex-1 py-2 px-4 rounded-md border font-medium transition-colors ${
              reportedToPolice === true
                ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            예
          </button>
          <button
            type="button"
            onClick={() => setValue('reported_to_police', false)}
            className={`flex-1 py-2 px-4 rounded-md border font-medium transition-colors ${
              reportedToPolice === false
                ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            아니오
          </button>
        </div>
      </div>

      {/* 경찰서 선택 (경찰 신고 시에만 표시) */}
      {reportedToPolice === true && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">신고하신 경찰서</label>
          <input
            type="text"
            value={policeSearch}
            onChange={(e) => setPoliceSearch(e.target.value)}
            placeholder="경찰서 이름 또는 지역 검색"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 mb-2"
          />
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white">
            {filteredStations.length === 0 ? (
              <p className="text-center py-4 text-gray-500">검색 결과가 없습니다.</p>
            ) : (
              filteredStations.map((station) => {
                const isSelected = watch('police_station_name') === station;
                return (
                  <button
                    key={station}
                    type="button"
                    onClick={() => {
                      setValue('police_station_name', station);
                      setPoliceSearch(station);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 border-l-4 border-l-indigo-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className={`font-medium ${isSelected ? 'text-indigo-700' : 'text-gray-900'}`}>
                      {station}
                    </span>
                    {isSelected && (
                      <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">제목 *</label>
        <input id="title" {...register('title', { required: '제목은 필수입니다.' })} className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"/>
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
      </div>
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700">내용</label>
        <textarea id="content" rows={10} {...register('content')} className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"/>
      </div>

      {/* 사기 카테고리 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">사기 카테고리</label>
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white">
          {FRAUD_CATEGORIES.map((cat) => {
            const isSelected = fraudCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setValue('fraud_category', cat)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-indigo-50 border-l-4 border-l-indigo-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <span className={`font-medium ${isSelected ? 'text-indigo-700' : 'text-gray-900'}`}>
                  {cat}
                </span>
                {isSelected && (
                  <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 기타 카테고리 직접 입력 */}
      {fraudCategory === '기타' && (
        <div>
          <label htmlFor="custom_fraud_category" className="block text-sm font-medium text-gray-700">사기 카테고리 직접 입력</label>
          <input
            id="custom_fraud_category"
            {...register('custom_fraud_category')}
            placeholder="사기 카테고리를 직접 입력하세요"
            className="w-full px-3 py-2 mt-1 border-2 border-indigo-500 rounded-md shadow-sm text-gray-900"
          />
        </div>
      )}

      {/* 사기꾼 정보 */}
      <div>
        <label htmlFor="scammer_nickname" className="block text-sm font-medium text-gray-700">사기꾼이 쓰는 닉네임</label>
        <input
          id="scammer_nickname"
          {...register('scammer_nickname')}
          placeholder="사기꾼이 사용하는 닉네임"
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
        />
      </div>
      <div>
        <label htmlFor="scammer_account_number" className="block text-sm font-medium text-gray-700">사기꾼이 쓰는 계좌번호</label>
        <input
          id="scammer_account_number"
          {...register('scammer_account_number')}
          placeholder="사기꾼이 사용하는 계좌번호"
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
        />
      </div>
      <div>
        <label htmlFor="scammer_phone_number" className="block text-sm font-medium text-gray-700">사기꾼이 쓰는 전화번호</label>
        <input
          id="scammer_phone_number"
          {...register('scammer_phone_number')}
          placeholder="- 없이 숫자만 입력"
          className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
        />
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700">태그 카테고리</label>
        <input id="category" {...register('category')} className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900" placeholder="(카테고리를 적어주세요. #소식공유 #검거완료 #신종범죄)"/>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">대표 이미지 {isEditMode && '(변경할 경우에만 업로드)'}</label>
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
          placeholder="예: www.tiktok.com/..., youtube.com/shorts/..., instagram.com/..."
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
      <div>
        <label htmlFor="author_name" className="block text-sm font-medium text-gray-700">작성자</label>
        <input id="author_name" {...register('author_name')} className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"/>
      </div>
      <div className="flex items-center">
        <input id="is_published" type="checkbox" {...register('is_published')} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
        <label htmlFor="is_published" className="ml-2 block text-sm text-gray-900">게시</label>
      </div>
      <button type="submit" disabled={isSubmitting} className="px-4 py-2 font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
        {isSubmitting ? '저장 중...' : (isEditMode ? '수정하기' : '생성하기')}
      </button>
    </form>
  );
}
