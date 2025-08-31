'use client';

import { useEffect, useMemo, useState } from 'react';

type Notice = {
  id: number;
  created_at: string;
  updated_at: string;
  author_id: string | null;
  title: string;
  body: string;
  pinned: boolean;
  // pinned_until / is_published 필드는 DB에 남아 있어도 UI/요청에서는 사용하지 않습니다.
  pinned_until: string | null;
  is_published: boolean;
};

type ListResponse = { ok: true; items: Notice[] } | { ok: false; error: string };
type MutateResponse = { ok: true; item?: Notice } | { ok: false; error: string };

export default function HelpNoticesAdminPage() {
  // 목록
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 폼(생성/수정 공용) — 고정 종료/공개 여부는 제거
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [pinned, setPinned] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setPinned(false);
    setSaveError(null);
  };

  const startEdit = (n: Notice) => {
    setEditingId(n.id);
    setTitle(n.title);
    setBody(n.body);
    setPinned(n.pinned);
    setSaveError(null);
    // 필요 시 스크롤 이동 로직 추가 가능
  };

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      setSaveError('제목과 본문을 입력해주세요.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      // ⬇️ pinned_only payload (pinned_until / is_published 제외)
      const payload = {
        title: title.trim(),
        body: body.trim(),
        pinned,
      };

      let res: Response;
      if (editingId) {
        res = await fetch(`/api/admin/help-notices/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/admin/help-notices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      }

      const json: MutateResponse = await res.json();
      if (!res.ok || !('ok' in json) || !json.ok) {
        throw new Error(('error' in json && json.error) || `HTTP ${res.status}`);
      }
      resetForm();
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const togglePinned = async (n: Notice) => {
    const body = {
      title: n.title,
      body: n.body,
      pinned: !n.pinned, // 토글만
    };
    await fetch(`/api/admin/help-notices/${n.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('정말 삭제하시겠어요?')) return;
    await fetch(`/api/admin/help-notices/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (editingId === id) resetForm();
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

      {/* 작성/수정 폼 (고정 종료/공개 제거) */}
      <div className="bg-white p-4 rounded shadow space-y-4">
        <h2 className="text-lg font-semibold">{editingId ? '공지 수정' : '공지 작성'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1">제목</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 헬프데스크 운영시간 안내"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1">본문</label>
            <textarea
              className="border rounded px-3 py-2 w-full min-h-[120px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="공지 내용을 입력하세요."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">최상단 고정</label>
            <div className="flex items-center gap-2">
              <input
                id="pinned"
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              <label htmlFor="pinned" className="text-sm text-gray-700">고정</label>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {editingId ? (saving ? '수정 중...' : '수정하기') : (saving ? '등록 중...' : '등록하기')}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              type="button"
              className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
            >
              취소
            </button>
          )}
          {saveError && <span className="text-sm text-red-600 self-center">{saveError}</span>}
        </div>
      </div>

      {/* 목록 (고정 종료/공개 컬럼 제거) */}
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
