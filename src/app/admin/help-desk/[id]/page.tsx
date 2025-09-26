'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import HelpDeskAnswerForm from '@/components/HelpDeskAnswerForm';

// API 응답에 맞춰 인터페이스는 최신 상태를 유지합니다.
interface Question {
  id: number;
  title: string;
  content: string;
  created_at: string;
  is_answered: boolean;
  user_id: string;
  user_name: string;
  user_phone: string;
  birth_date: string;
  province: string;
  city: string;
  victim_type: string;
  damage_category: string;
  conversation_reason: string;
  opponent_account: string;
  opponent_phone: string;
  opponent_sns: string;
  case_summary: string;
  users: {
    nickname: string;
  } | null;
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
        if (!res.ok) throw new Error('데이터를 불러오는 데 실패했습니다.');
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


  if (loading) return <div className="p-4">문의 내용을 불러오는 중...</div>;
  if (error) return <p className="p-4 text-red-500">오류: {error}</p>;
  if (!data?.question) return <p className="p-4">해당 문의를 찾을 수 없습니다.</p>

  const { question, answer } = data;

  return (
    <div className="container mx-auto p-0 md:p-4 space-y-8">
      <div>
        <button onClick={() => router.back()} className="mb-6 text-indigo-600 hover:underline">
          &larr; 목록으로 돌아가기
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{question.title || '제목 없음'}</h1>
        <div className="text-sm text-gray-500 flex items-center gap-x-3">
          <span>문의일: {new Date(question.created_at).toLocaleString()}</span>
          <span className="text-gray-300">|</span>
          <span>상태: {question.is_answered ?
            <span className="font-semibold text-green-600">답변 완료</span> :
            <span className="font-semibold text-yellow-600">답변 대기</span>
          }</span>
        </div>
      </div>

      {/* 작성자 정보 섹션: 기존 2단 그리드 UI 유지 */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">작성자 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <p className="text-sm font-medium text-gray-500">이름 (닉네임)</p>
            <p className="text-lg text-gray-800">
              {question.user_name || 'N/A'}
              {question.users?.nickname && (
                <span className="ml-2 text-gray-500 font-normal">({question.users.nickname})</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">연락처</p>
            <p className="text-lg text-gray-800">{question.user_phone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">생년월일</p>
            <p className="text-lg text-gray-800">{question.birth_date || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">거주 지역</p>
            <p className="text-lg text-gray-800">{`${question.province || ''} ${question.city || ''}`.trim() || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* 사용자 작성 내용 섹션: 기존 수직 스택 UI 유지 */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">사용자 작성 내용</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-500">피해자 유형</p>
            <p className="text-gray-800 mt-1 font-semibold">{question.victim_type || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">피해 카테고리</p>
            <p className="text-gray-800 mt-1 font-semibold">{question.damage_category || 'N/A'}</p>
          </div>
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
            <p className="text-sm font-medium text-gray-500">사건 개요 (본문)</p>
            <p className="text-gray-800 whitespace-pre-wrap mt-1 bg-gray-50 p-4 rounded-md border">{question.case_summary || question.content || 'N/A'}</p>
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
