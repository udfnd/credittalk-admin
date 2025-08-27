// src/app/admin/push/page.tsx
'use client';

import { useEffect, useState, Fragment } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

type JobData = {
  screen?: string;
  params?: string;
  image?: string;
} | null;

type AudienceAll = { all: true };
type Audience = AudienceAll | Record<string, unknown>;

type JobResult = {
  sent: number;
  total: number;
  failed: number;
  dry_run: boolean;
  disabled_tokens: number;
} | null;

type PushJob = {
  id: number;
  created_at: string;
  created_by: string | null;
  title: string;
  body: string;
  data: JobData;
  audience: Audience | null;
  target_user_ids: string[] | null;
  dry_run: boolean;
  scheduled_at: string | null;
  status: JobStatus;
  result: JobResult;
};

type EnqueueOk = { ok: true; job: PushJob };

function isAudienceAll(aud: Audience | null | undefined): aud is AudienceAll {
  return !!aud && typeof aud === 'object' && 'all' in aud && (aud as Record<string, unknown>).all === true;
}

export default function PushComposerPage() {
  const supabase = createClientComponentClient();

  // form state
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>(''); // 업로드된 이미지 URL
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ui state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EnqueueOk | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // 간단한 클라이언트 검증
    if (!file.type.startsWith('image/')) {
      setUploadError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('최대 5MB까지 업로드 가능합니다.');
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/push/upload', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || `업로드 실패 (HTTP ${res.status})`);
      setImageUrl(json.imageUrl as string);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (): Promise<void> => {
    try {
      setSubmitting(true);
      setError(null);
      setResult(null);

      const payload: { title: string; body: string; imageUrl?: string } = {
        title,
        body,
        ...(imageUrl ? { imageUrl } : {}),
      };

      const res = await fetch('/api/push/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json: EnqueueOk = await res.json();
      if (!res.ok) {
        throw new Error((json as unknown as { error?: string })?.error ?? `HTTP ${res.status}`);
      }

      setResult(json);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-0 md:p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">푸시 발송</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin" className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200">대시보드</Link>
          <Link href="/admin/posts" className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200">게시글 관리</Link>
        </div>
      </div>

      {/* 폼 */}
      <div className="bg-white shadow-md rounded-lg p-4 md:p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">제목</label>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="예) 시스템 점검 안내"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">이미지 업로드 (선택)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {uploading && <p className="text-xs text-gray-500 mt-1">업로드 중...</p>}
            {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
            {imageUrl && (
              <div className="mt-2">
                <p className="text-xs text-gray-500">업로드 완료</p>
                {/* 간단 미리보기 */}
                <img src={imageUrl} alt="preview" className="mt-1 max-h-40 rounded border" />
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">본문</label>
            <textarea
              className="border rounded px-3 py-2 w-full min-h-[100px]"
              placeholder="예) 오늘 02:00~03:00 시스템 점검으로 서비스 이용이 원활하지 않을 수 있습니다."
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={submit}
            disabled={submitting || uploading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? '보내는 중...' : '알람 보내기'}
          </button>
          {error && <span className="ml-3 text-sm text-red-600">{error}</span>}
        </div>

        {result && (
          <div className="mt-4">
            <pre className="bg-gray-50 border rounded p-3 text-sm overflow-auto">
{JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
