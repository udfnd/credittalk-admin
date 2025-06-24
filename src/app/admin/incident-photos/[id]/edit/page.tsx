// src/app/admin/incident-photos/[id]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import IncidentPhotoForm from '@/components/IncidentPhotoForm';

interface IncidentPhoto {
  id: number;
  title: string;
  description?: string;
  category?: string;
  image_url?: string;
  is_published: boolean;
}

export default function EditIncidentPhotoPage() {
  const params = useParams();
  const id = params.id as string;
  const [photo, setPhoto] = useState<IncidentPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/incident-photos/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch photo data');
        return res.json();
      })
      .then(data => {
        setPhoto(data);
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
      <h1 className="mb-6 text-3xl font-bold text-gray-900">사건 사진자료 수정</h1>
      {photo ? (
        <IncidentPhotoForm initialData={photo} />
      ) : (
        <p>해당 자료를 찾을 수 없습니다.</p>
      )}
    </div>
  );
}
