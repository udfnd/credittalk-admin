// src/app/admin/help-desk/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import HelpDeskAnswerForm from '@/components/HelpDeskAnswerForm';

// API에서 받아오는 모든 컬럼을 포함하도록 인터페이스 확장
interface Question {
  id: number;
  title: string;
  content: string;
  created_at: string;
  is_answered: boolean;
  // 작성자 정보
  user_name: string;
  user_phone: string;
  // 상대방 정보 및 사건 개요
  conversation_reason: string;
  opponent_account: string;
  opponent_phone: string;
  opponent_sns: string;
  case_summary: string;
  user_id: string;
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
    fetchData();
    router.refresh();
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;
  if (!data?.question) return <p>해당 문의를 찾을 수 없습니다.</p>

  const { question, answer } = data;

  return (
    <div className="container mx-auto p-0 md:p-4 space-y-8">
      <div>
        <button onClick={() => router.back()} className="mb-6 text-indigo-600 hover:underline">
          &larr; 목록으로 돌아가기
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{question.title || '제목 없음'}</h1>
        <div className="text-sm text-gray-500">
          <span>문의일: {new Date(question.created_at).toLocaleString()}</span>
          <span className="mx-2">|</span>
          <span>상태: {question.is_answered ?
            <span className="font-semibold text-green-600">답변 완료</span> :
            <span className="font-semibold text-yellow-600">답변 대기</span>
          }</span>
        </div>
      </div>

      {/* 작성자 정보 섹션 */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">작성자 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">이름</p>
            <p className="text-lg text-gray-800">{question.user_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">연락처</p>
            <p className="text-lg text-gray-800">{question.user_phone || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* 상대방 정보 및 사건 개요 섹션 */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">사용자 작성 내용</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-500">상대방과 대화 계기</p>
            <p className="text-gray-800 whitespace-pre-wrap mt-1">{question.conversation_reason || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">상대방 연락처</p>
            <p className="text-gray-800 mt-1">{question.opponent_phone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">상대방 계좌번호</p>
            <p className="text-gray-800 mt-1">{question.opponent_account || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">상대방 SNS</p>
            <p className="text-gray-800 mt-1">{question.opponent_sns || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">사건 개요</p>
            <p className="text-gray-800 whitespace-pre-wrap mt-1">{question.case_summary || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">문의 내용 (본문)</p>
            <p className="text-gray-800 whitespace-pre-wrap mt-1 bg-gray-50 p-3 rounded-md">{question.content || 'N/A'}</p>
          </div>
        </div>
      </div>


      <HelpDeskAnswerForm
        questionId={question.id}
        initialContent={answer?.content}
        targetAuthUserId={question.user_id}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
