// src/app/admin/notices/[id]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import NoticeForm from '@/components/NoticeForm';

interface Notice {
  id: number;
  title: string;
  content: string;
  author_name?: string;
  image_url?: string;
  link_url?: string;
  is_published: boolean;
}

export default function EditNoticePage() {
  const params = useParams();
  const id = params.id as string;
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/notices/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch notice data');
        return res.json();
      })
      .then(data => {
        setNotice(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">공지사항 수정</h1>
      {notice ? (
        <NoticeForm initialData={notice} />
      ) : (
        <p>해당 게시글을 찾을 수 없습니다.</p>
      )}
    </div>
  );
}
