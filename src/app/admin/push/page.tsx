// src/app/admin/push/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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

type SearchItem = {
  user_id: string;                 // auth.users.id (UUID)
  last_seen: string | null;
  profile?: {
    name?: string | null;
    nickname?: string | null;
    phone?: string | null;
    email?: string | null;
    app_user_id?: number | null;   // 선택
  };
};

export default function PushComposerPage() {
  // ── 발송 폼 상태 ─────────────────────────────────────────────
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');

  // 이미지 업로드
  const [imageUrl, setImageUrl] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 발송 결과
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EnqueueOk | null>(null);

  // ── 대상 유저 검색/선택 ─────────────────────────────────────
  const [q, setQ] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // auth user uuid들

  const hasSelection = selectedIds.length > 0;

  const visibleResults = useMemo(() => results.slice(0, 50), [results]);

  const handleToggleSelect = (uid: string) => {
    setSelectedIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleSelectAll = () => {
    const ids = visibleResults.map(r => r.user_id);
    setSelectedIds(prev => {
      const set = new Set(prev);
      ids.forEach(id => set.add(id));
      return Array.from(set);
    });
  };

  const handleClearSelection = () => setSelectedIds([]);

  const runSearch = async () => {
    setSearching(true);
    setSearchError(null);
    try {
      const url = q.trim()
        ? `/api/push/search-users?q=${encodeURIComponent(q.trim())}`
        : `/api/push/search-users`;
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setResults(Array.isArray(json?.items) ? json.items as SearchItem[] : []);
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  };

  // 첫 진입 시 최근 토큰 보유 유저 로드
  useEffect(() => { runSearch(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ── 이미지 업로드 ───────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

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

  // ── 발송 ───────────────────────────────────────────────────
  const submit = async (): Promise<void> => {
    try {
      setSubmitting(true);
      setError(null);
      setResult(null);

      const payload: {
        title: string;
        body: string;
        imageUrl?: string;
        targetUserIds?: string[];
      } = {
        title,
        body,
        ...(imageUrl ? { imageUrl } : {}),
        ...(hasSelection ? { targetUserIds: selectedIds } : {}), // 선택 있으면 대상 지정
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
    <div className="container mx-auto p-0 md:p-4 space-y-8">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">푸시 발송</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin" className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200">대시보드</Link>
          <Link href="/admin/posts" className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200">게시글 관리</Link>
        </div>
      </div>

      {/* ① 대상 유저 검색/선택 */}
      <div className="bg-white shadow-md rounded-lg p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-4">대상 유저 검색</h2>

        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <input
            className="border rounded px-3 py-2 w-full md:w-80"
            placeholder="이름/닉네임으로 검색"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={runSearch}
              disabled={searching}
              className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              {searching ? '검색 중…' : '검색'}
            </button>
            <button
              onClick={handleSelectAll}
              className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100"
            >
              현재 목록 전체 선택
            </button>
            <button
              onClick={handleClearSelection}
              className="px-3 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100"
            >
              선택 해제
            </button>
          </div>
        </div>

        {searchError && <p className="mt-3 text-sm text-red-600">{searchError}</p>}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">선택</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">이름/닉네임</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">최근 접속</th>
            </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
            {visibleResults.map(r => {
              const checked = selectedIds.includes(r.user_id);
              const name = r.profile?.name || '';
              const nick = r.profile?.nickname || '';
              const left = [name, nick].filter(Boolean).join(' / ') || '-';
              const lastSeen = r.last_seen ? new Date(r.last_seen).toLocaleString() : '-';
              return (
                <tr key={r.user_id} className={checked ? 'bg-indigo-50' : undefined}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleSelect(r.user_id)}
                    />
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900">{left}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">{lastSeen}</td>
                </tr>
              );
            })}
            {!visibleResults.length && (
              <tr><td className="px-3 py-8 text-center text-gray-500" colSpan={5}>검색 결과가 없습니다.</td></tr>
            )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-sm text-gray-600">
          선택된 사용자: <span className="font-semibold">{selectedIds.length}</span>명
          {selectedIds.length === 0 && ' (선택하지 않으면 전체 발송)'}
        </p>
      </div>

      {/* ② 발송 폼 */}
      <div className="bg-white shadow-md rounded-lg p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-4">메시지 작성</h2>

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
            {submitting ? '보내는 중...' : (hasSelection ? '선택 대상에게 보내기' : '전체에게 보내기')}
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
