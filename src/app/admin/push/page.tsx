// src/app/admin/push/page.tsx
'use client';

import { useEffect, useState, Fragment } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

type JobData = {
  screen?: string;
  params?: string; // 서버에서 문자열(JSON string)로 보관 중이라면 string 유지
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
  const [scheduledAt, setScheduledAt] = useState<string>(''); // 표시용(현재 즉시 발송)

  // ui state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EnqueueOk | null>(null);

  // jobs list
  const [jobs, setJobs] = useState<PushJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState<boolean>(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const fetchJobs = async (): Promise<void> => {
    setLoadingJobs(true);
    setJobsError(null);

    const { data, error } = await supabase
      .from('push_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      setJobsError(error.message);
    } else {
      setJobs((data as PushJob[]) ?? []);
    }
    setLoadingJobs(false);
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (): Promise<void> => {
    try {
      setSubmitting(true);
      setError(null);
      setResult(null);

      // 현재는 전체 즉시 발송만 지원
      const payload: { title: string; body: string } = {
        title,
        body,
      };

      const res = await fetch('/api/push/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // 세션 쿠키 전송
        body: JSON.stringify(payload),
      });

      const json: EnqueueOk = await res.json();
      if (!res.ok) {
        // 서버가 에러 메시지를 텍스트로 줄 수도 있으므로 보수적으로 처리
        throw new Error((json as unknown as { error?: string })?.error ?? `HTTP ${res.status}`);
      }

      setResult(json);
      fetchJobs();
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
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">본문</label>
            <textarea
              className="border rounded px-3 py-2 w-full min-h-[100px]"
              placeholder="예) 오늘 02:00~03:00 시스템 점검으로 서비스 이용이 원활하지 않을 수 있습니다."
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          </div>

          {/* 필요 시 딥링크/타게팅 UI를 여기에 추가 */}
        </div>

        <div className="mt-6">
          <button
            onClick={submit}
            disabled={submitting}
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

      {/* 최근 푸시 작업 목록 */}
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-semibold">최근 푸시 작업</h2>
          <button onClick={fetchJobs} className="px-3 py-1.5 bg-gray-100 rounded hover:bg-gray-200">새로고침</button>
        </div>
        {loadingJobs ? (
          <p className="text-center py-6">불러오는 중...</p>
        ) : jobsError ? (
          <p className="text-center text-red-500 py-6">오류: {jobsError}</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 responsive-table">
            <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제목</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">대상</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">예약</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">결과</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작성일</th>
            </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 md:divide-y-0">
            {jobs.map(job => (
              <Fragment key={job.id}>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{job.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {job.title}
                    {job.data?.screen && <span className="ml-2 text-xs text-gray-500">→ {job.data.screen}</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {job.target_user_ids?.length
                      ? `${job.target_user_ids.length}명`
                      : (isAudienceAll(job.audience) ? '전체' : '조건')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={[
                          'px-2 py-0.5 rounded text-xs',
                          job.status === 'queued' && 'bg-yellow-100 text-yellow-800',
                          job.status === 'processing' && 'bg-blue-100 text-blue-800',
                          job.status === 'done' && 'bg-green-100 text-green-800',
                          job.status === 'failed' && 'bg-red-100 text-red-800',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {job.status}
                      </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {job.result ? JSON.stringify(job.result) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(job.created_at).toLocaleString()}
                  </td>
                </tr>
              </Fragment>
            ))}
            {!jobs.length && (
              <tr>
                <td className="px-6 py-8 text-center text-gray-500" colSpan={7}>
                  아직 등록된 작업이 없습니다.
                </td>
              </tr>
            )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
