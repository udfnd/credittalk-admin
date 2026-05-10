'use client';

import { useEffect, useMemo, useState } from 'react';
import HelpNoticeForm from '@/components/HelpNoticeForm';

type Notice = {
  id: number;
  created_at: string;
  updated_at: string;
  author_id: string | null;
  title: string;
  body: string;
  pinned: boolean;
  pinned_until: string | null;
  is_published: boolean;
  image_urls: string[] | null;
  link_url: string | null;
};

type ListResponse = { ok: true; items: Notice[] } | { ok: false; error: string };

export default function HelpNoticesAdminPage() {
  // 목록
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 편집 모드
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/admin/help-notices', { credentials: 'include' });
      const json: ListResponse = await res.json();
      if (!res.ok || !('ok' in json) || !json.ok) {
        throw new Error(('error' in json && json.error) || `HTTP ${res.status}`);
      }
      setItems(json.items);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (n: Notice) => {
    setEditingNotice(n);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const cancelEdit = () => {
    setEditingNotice(null);
  };

  const handleSaved = async () => {
    setEditingNotice(null);
    await load();
  };

  const togglePinned = async (n: Notice) => {
    await fetch(`/api/admin/help-notices/${n.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pinned: !n.pinned }),
    });
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('정말 삭제하시겠어요?')) return;
    await fetch(`/api/admin/help-notices/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (editingNotice?.id === id) setEditingNotice(null);
    load();
  };

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }),
    [items]
  );

  return (
    <div className="container mx-auto p-4 space-y-8">
      <h1 className="text-2xl font-bold">헬프데스크 공지 관리</h1>

      {/* 작성/수정 폼 */}
      <HelpNoticeForm
        key={editingNotice?.id ?? 'new'}
        initialData={
          editingNotice
            ? {
                id: editingNotice.id,
                title: editingNotice.title,
                body: editingNotice.body,
                pinned: editingNotice.pinned,
                pinned_until: editingNotice.pinned_until,
                is_published: editingNotice.is_published,
                image_urls: editingNotice.image_urls ?? [],
                link_url: editingNotice.link_url ?? '',
              }
            : undefined
        }
        onSaved={handleSaved}
        onCancel={cancelEdit}
      />

      {/* 목록 */}
      <div className="bg-white p-4 rounded shadow overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">공지 목록</h2>
          <button onClick={load} className="px-3 py-1.5 bg-gray-100 rounded hover:bg-gray-200">새로고침</button>
        </div>

        {loading ? (
          <p>불러오는 중...</p>
        ) : loadError ? (
          <p className="text-red-600">오류: {loadError}</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">ID</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">제목</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">고정</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">작성일</th>
              <th className="px-3 py-2" />
            </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
            {sorted.map((n) => (
              <tr key={n.id}>
                <td className="px-3 py-2">{n.id}</td>
                <td className="px-3 py-2 max-w-[360px]">
                  <div className="font-medium text-gray-900 truncate">{n.title}</div>
                  <div className="text-xs text-gray-500 truncate">{n.body}</div>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => togglePinned(n)}
                    className={`px-2 py-1 text-xs rounded ${n.pinned ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'}`}
                  >
                    {n.pinned ? '고정됨' : '해제'}
                  </button>
                </td>
                <td className="px-3 py-2">{new Date(n.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-right space-x-2">
                  <button className="text-indigo-600" onClick={() => startEdit(n)}>수정</button>
                  <button className="text-red-600" onClick={() => remove(n.id)}>삭제</button>
                </td>
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  등록된 공지가 없습니다.
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
