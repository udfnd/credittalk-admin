// src/app/admin/new-crime-cases/[id]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import NewCrimeCaseForm from '@/components/NewCrimeCaseForm';

interface NewCrimeCase {
  id: number;
  method: string;
  image_urls?: string[];
  is_published: boolean;
}

export default function EditNewCrimeCasePage() {
  const params = useParams();
  const id = params.id as string;
  const [crimeCase, setCrimeCase] = useState<NewCrimeCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/new-crime-cases/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch new crime case data');
        return res.json();
      })
      .then(data => {
        setCrimeCase(data);
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
      <h1 className="mb-6 text-3xl font-bold text-gray-900">신종범죄 사례 수정</h1>
      {crimeCase ? (
        <NewCrimeCaseForm initialData={crimeCase} />
      ) : (
        <p>해당 사례를 찾을 수 없습니다.</p>
      )}
    </div>
  );
}
