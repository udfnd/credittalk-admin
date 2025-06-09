// src/app/admin/help-desk/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import HelpDeskAnswerForm from '@/components/HelpDeskAnswerForm';

interface Question {
  id: number;
  title: string;
  content: string;
  created_at: string;
  author_name: string;
  is_answered: boolean;
}

interface Answer {
  id: number;
  content: string;
  created_at: string;
}

export default function AnswerQuestionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [data, setData] = useState<{ question: Question; answer: Answer | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/admin/help-desk/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch data');
        return res.json();
      })
      .then(fetchedData => {
        setData(fetchedData);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleSuccess = () => {
    // 답변 성공 후 데이터 다시 불러오기
    fetchData();
    // 목록 페이지의 데이터도 갱신
    router.refresh();
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;
  if (!data?.question) return <p>해당 문의를 찾을 수 없습니다.</p>

  const { question, answer } = data;

  return (
    <div className="container mx-auto p-0 md:p-4">
      <button onClick={() => router.back()} className="mb-6 text-indigo-600 hover:underline">
        &larr; 목록으로 돌아가기
      </button>
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{question.title}</h1>
      <div className="text-sm text-gray-500 mb-6">
        <span>작성자: {question.author_name || 'N/A'}</span>
        <span className="mx-2">|</span>
        <span>문의일: {new Date(question.created_at).toLocaleString()}</span>
        <span className="mx-2">|</span>
        <span>상태: {question.is_answered ? '답변 완료' : '답변 대기'}</span>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-3">문의 내용</h2>
        <p className="text-gray-800 whitespace-pre-wrap">{question.content}</p>
      </div>

      <HelpDeskAnswerForm
        questionId={question.id}
        initialContent={answer?.content}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
