// src/app/admin/push/page.tsx
'use client';

import { useEffect, useState, Fragment } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type PushJob = {
  id: number;
  created_at: string;
  created_by: string | null;
  title: string;
  body: string;
  data: { screen?: string; params?: string } | null;
  audience: any | null;
  target_user_ids: string[] | null;
  dry_run: boolean;
  scheduled_at: string | null;
  status: 'queued' | 'processing' | 'done' | 'failed';
  result: any | null;
};

export default function PushComposerPage() {
  const supabase = createClientComponentClient();

  // form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [screen, setScreen] = useState('');        // (선택) 딥링크 screen
  const [params, setParams] = useState('');        // (선택) JSON 문자열: {"id":123}
  const [userIdsCsv, setUserIdsCsv] = useState(''); // (선택) uuid CSV
  const [scheduledAt, setScheduledAt] = useState<string>(''); // (표시는 하지만 즉시 발송이라 서버에서 무시)

  // ui state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // jobs list
  const [jobs, setJobs] = useState<PushJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoadingJobs(true);
    setJobsError(null);
    const { data, error } = await supabase
      .from('push_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) setJobsError(error.message);
    else setJobs((data as PushJob[]) ?? []);
    setLoadingJobs(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [supabase]);

  const submit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      setResult(null);

      const targetUserIds = userIdsCsv
        ? userIdsCsv.split(',').map(s => s.trim()).filter(Boolean)
        : null;

      const payload = {
        title,
        body,
        data: screen ? { screen, ...(params ? { params } : {}) } : null,
        audience: targetUserIds ? null : { all: true },
        targetUserIds,
        // 즉시 발송이므로 서버에서 dryRun/scheduledAt은 무시
      };

      const res = await fetch('/api/push/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // 세션 쿠키 전송
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setResult(json);
      fetchJobs();
    } catch (e: any) {
      setError(e?.message ?? 'unknown error');
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
            <label className="block text-sm font-medium mb-1">예약 발송 (표시용)</label>
            <input
              type="datetime-local"
              className="border rounded px-3 py-2 w-full"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">※ 현재는 즉시 발송만 지원합니다.</p>
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

          {/* 필요 시 딥링크 UI를 주석 해제하세요 */}
          {/* <div>
            <label className="block text-sm font-medium mb-1">딥링크 screen (선택)</label>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="예) NoticeList, HelpDeskDetail 등"
              value={screen}
              onChange={e => setScreen(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">딥링크 params (JSON 문자열, 선택)</label>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder='예) {"id":123}'
              value={params}
              onChange={e => setParams(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">특정 user_id CSV (없으면 전체 발송)</label>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="uuid1, uuid2, uuid3"
              value={userIdsCsv}
              onChange={e => setUserIdsCsv(e.target.value)}
            />
          </div> */}
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
                      : (job.audience?.all ? '전체' : '조건')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={[
                        'px-2 py-0.5 rounded text-xs',
                        job.status === 'queued' && 'bg-yellow-100 text-yellow-800',
                        job.status === 'processing' && 'bg-blue-100 text-blue-800',
                        job.status === 'done' && 'bg-green-100 text-green-800',
                        job.status === 'failed' && 'bg-red-100 text-red-800',
                      ].filter(Boolean).join(' ')}
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
              <tr><td className="px-6 py-8 text-center text-gray-500" colSpan={7}>아직 등록된 작업이 없습니다.</td></tr>
            )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
