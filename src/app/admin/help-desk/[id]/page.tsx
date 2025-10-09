// /src/app/admin/help-desk/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import HelpDeskAnswerForm from '@/components/HelpDeskAnswerForm'; // 이 컴포넌트는 그대로 사용

// ⭐️ DB 스키마와 일치시킨 Question 인터페이스
interface Question {
  id: number;
  created_at: string;
  user_id: string; // auth.users.id
  title: string | null;
  content: string | null;
  is_answered: boolean;
  user_name: string | null;
  user_phone: string | null;
  conversation_reason: string | null;
  opponent_account: string | null;
  opponent_phone: string | null;
  opponent_sns: string | null;
  case_summary: string | null;
  users: { // JOIN된 사용자 정보
    nickname: string | null;
    name: string | null;
  } | null;
}

interface Comment {
  id: number;
  content: string;
  created_at: string;
  users: { // 작성자 정보
    is_admin: boolean;
    name: string | null;
    nickname: string | null;
  } | null;
}

export default function AnswerQuestionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // ⭐️ 상태 타입 변경: 답변은 여러 개일 수 있으므로 배열로 처리
  const [question, setQuestion] = useState<Question | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 현재 코드는 API를 호출한다고 가정하고 있으므로, 이 부분은 그대로 둡니다.
  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/help-desk/${id}`);
      if (!res.ok) throw new Error('데이터를 불러오는 데 실패했습니다.');

      const { question: fetchedQuestion, comments: fetchedComments } = await res.json();
      setQuestion(fetchedQuestion);
      setComments(fetchedComments || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // id가 변경될 때마다 데이터를 다시 불러옵니다.
    fetchData();
  }, [id]);

  const handleSuccess = () => {
    fetchData(); // 답변/수정 성공 시 데이터 새로고침
  };

  // 관리자가 작성한 최신 답변을 찾습니다.
  const adminAnswer = comments.find(c => c.users?.is_admin);

  if (loading) return <div className="p-4">문의 내용을 불러오는 중...</div>;
  if (error) return <p className="p-4 text-red-500">오류: {error}</p>;
  if (!question) return <p className="p-4">해당 문의를 찾을 수 없습니다.</p>

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

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">작성자 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <p className="text-sm font-medium text-gray-500">이름 (닉네임)</p>
            <p className="text-lg text-gray-800">
              {question.user_name || question.users?.name || 'N/A'}
              {question.users?.nickname && (
                <span className="ml-2 text-gray-500 font-normal">({question.users.nickname})</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">연락처</p>
            <p className="text-lg text-gray-800">{question.user_phone || 'N/A'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">사용자 작성 내용</h2>
        {/* 기존 사용자 작성 내용 UI는 그대로 유지 */}
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
            <p className="text-sm font-medium text-gray-500">사건 개요 (본문)</p>
            <p className="text-gray-800 whitespace-pre-wrap mt-1 bg-gray-50 p-4 rounded-md border">{question.case_summary || question.content || 'N/A'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">문의 및 답변 내역</h2>
        <div className="space-y-4">
          {comments.length > 0 ? (
            comments.map((comment) => {
              const isAdmin = comment.users?.is_admin;
              const authorName = isAdmin
                ? '관리자'
                : comment.users?.nickname || comment.users?.name || '작성자';

              return (
                // isAdmin 값에 따라 댓글 컨테이너의 정렬을 변경 (관리자: 오른쪽, 사용자: 왼쪽)
                <div key={comment.id} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                  {/* isAdmin 값에 따라 댓글의 배경색을 다르게 설정 */}
                  <div className={`p-4 rounded-lg max-w-xl ${isAdmin ? 'bg-indigo-100 text-indigo-900' : 'bg-gray-100 text-gray-900'}`}>
                    <div className="flex items-center mb-2">
                      <p className="font-bold text-sm">{authorName}</p>
                    </div>
                    <p className="text-base whitespace-pre-wrap">{comment.content}</p>
                    <p className="text-xs text-gray-500 mt-2 text-right">
                      {new Date(comment.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-gray-500 text-center py-4">아직 댓글이 없습니다.</p>
          )}
        </div>
      </div>

      <HelpDeskAnswerForm
        questionId={question.id}
        initialContent={adminAnswer?.content} // 관리자가 쓴 답변을 초기값으로 설정
        targetAuthUserId={question.user_id}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
