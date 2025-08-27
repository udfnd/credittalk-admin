// src/app/admin/partners/page.tsx
'use client';

import { useEffect, useState } from 'react';

type Banner = {
  id: number;
  title: string | null;
  image_url: string;
  link_url: string | null;
  sort: number;
  is_active: boolean;
  created_at: string;
};

export default function PartnersAdminPage() {
  const [items, setItems] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  // 업로드 폼 상태
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // 👈 미리보기 URL
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/partners', { credentials: 'include' });
    const json = await res.json();
    if (res.ok && json.ok) setItems(json.items as Banner[]);
    else setError(json?.error || '불러오기 실패');
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // 파일 선택 시 미리보기 생성
  const onSelectFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setError(null);
    const f = e.target.files?.[0] ?? null;
    setFile(f);

    // 이전 미리보기 URL 정리
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    // 새 미리보기 URL 생성
    if (f) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onUpload = async () => {
    if (!file) { setError('이미지를 선택하세요'); return; }
    setSaving(true); setError(null);
    try {
      // 1) 업로드
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch('/api/admin/partners/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const upJson = await up.json();
      if (!up.ok || !upJson.ok) throw new Error(upJson?.error || '업로드 실패');
      const image_url: string = upJson.imageUrl;

      const res = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title || null,
          image_url,
          link_url: link || null,
          is_active: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error || '저장 실패');

      // 업로드 폼 초기화 + 미리보기 정리
      setFile(null);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
      setTitle('');
      setLink('');

      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    await fetch(`/api/admin/partners/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ is_active: !isActive }),
    });
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('삭제할까요?')) return;
    await fetch(`/api/admin/partners/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    load();
  };

  const clearSelected = () => {
    setFile(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
  };

  return (
    <div className="container mx-auto p-4 space-y-8">
      <h1 className="text-2xl font-bold">제휴사 배너 관리</h1>

      <div className="bg-white p-4 rounded shadow space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">이미지</label>
            <input
              type="file"
              accept="image/*"
              onChange={onSelectFile}
            />
            {/* ✅ 선택한 파일 미리보기 */}
            {previewUrl && (
              <div className="mt-2">
                <img
                  src={previewUrl}
                  alt="preview"
                  className="h-24 w-auto rounded border"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
                    onClick={clearSelected}
                  >
                    선택 취소
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">제목(선택)</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={title}
              onChange={e=>setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">링크(선택)</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={link}
              onChange={e=>setLink(e.target.value)}
              placeholder="https:// 또는 http:// 로 시작"
            />
          </div>
        </div>

        <button
          onClick={onUpload}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '추가'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="bg-white p-4 rounded shadow">
        {loading ? (
          <p>불러오는 중...</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">미리보기</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">제목</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">링크</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">정렬</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">활성</th>
              <th className="px-3 py-2" />
            </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
            {items.map(b => (
              <tr key={b.id}>
                <td className="px-3 py-2">
                  <img src={b.image_url} alt="" className="h-12 w-auto rounded" />
                </td>
                <td className="px-3 py-2">{b.title || '-'}</td>
                <td className="px-3 py-2 text-blue-600">{b.link_url || '-'}</td>
                <td className="px-3 py-2">{b.sort}</td>
                <td className="px-3 py-2">
                  <button
                    className={`px-2 py-1 text-xs rounded ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                    onClick={() => toggleActive(b.id, b.is_active)}
                  >
                    {b.is_active ? '활성' : '비활성'}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <button className="text-red-600" onClick={() => remove(b.id)}>삭제</button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  등록된 배너가 없습니다.
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
