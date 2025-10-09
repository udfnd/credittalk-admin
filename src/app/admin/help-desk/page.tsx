// /src/app/admin/help-desk/page.tsx
'use client';

import { useEffect, useState, ChangeEvent, useCallback } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Supabase RPC 호출로 받아오는 데이터의 타입을 명확하게 정의
// is_published_as_crime_case는 클라이언트에서 추가되므로 제외
type HelpQuestionFromRPC = Omit<HelpQuestion, 'is_published_as_crime_case'>;

// 최종적으로 UI에 표시될 데이터 타입
interface HelpQuestion {
  id: number;
  created_at: string;
  title: string | null;
  case_summary: string | null;
  is_answered: boolean;
  user_name: string | null;
  is_published_as_crime_case: boolean;
  content: string | null;
  user_id: string;
}

export default function ManageHelpDeskPage() {
  const supabase = createClientComponentClient();
  const [questions, setQuestions] = useState<HelpQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 데이터 조회 로직을 RPC 중심으로 효율적으로 재구성
  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. RPC를 호출하여 질문 목록과 '답변 여부(is_answered)'를 한 번에 가져옵니다.
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_help_questions_with_status')
        .order('created_at', { ascending: false });

      if (rpcError) throw rpcError;

      // rpcData의 타입을 HelpQuestionFromRPC 배열로 명확히 지정
      const questionsData = rpcData as HelpQuestionFromRPC[];

      if (!questionsData || questionsData.length === 0) {
        setQuestions([]);
        return;
      }

      const questionIds = questionsData.map(q => q.id);

      // 2. '공개 여부' 정보만 추가로 가져옵니다.
      const { data: crimeCases, error: crimeCaseError } = await supabase
        .from('new_crime_cases')
        .select('source_help_question_id')
        .in('source_help_question_id', questionIds);

      if (crimeCaseError) throw crimeCaseError;

      const publishedQuestionIds = new Set(crimeCases.map(c => c.source_help_question_id));

      // 3. 두 데이터를 조합하여 최종 상태(HelpQuestion)를 만듭니다.
      // `q`의 타입이 HelpQuestionFromRPC로 추론되므로 더 이상 `any`가 필요 없습니다.
      const processedData: HelpQuestion[] = questionsData.map(q => ({
        ...q,
        is_published_as_crime_case: publishedQuestionIds.has(q.id),
      }));

      setQuestions(processedData);

    } catch (err) {
      // `any` 대신 `unknown` 타입을 안전하게 처리
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error fetching questions:", errorMessage);
      setError("문의 목록을 불러오는 데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handlePublishChange = async (questionId: number, event: ChangeEvent<HTMLSelectElement>) => {
    const shouldPublish = event.target.value === 'true';

    setQuestions(prev =>
      prev.map(q =>
        q.id === questionId ? { ...q, is_published_as_crime_case: shouldPublish } : q
      )
    );

    try {
      if (shouldPublish) {
        const questionToPublish = questions.find(q => q.id === questionId);
        if (!questionToPublish) throw new Error("해당 문의 정보를 찾을 수 없습니다.");

        const { error } = await supabase.from('new_crime_cases').insert({
          source_help_question_id: questionId,
          title: questionToPublish.title || '공개된 상담 사례',
          method: questionToPublish.case_summary || questionToPublish.content || '내용 없음',
          user_id: questionToPublish.user_id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('new_crime_cases')
          .delete()
          .eq('source_help_question_id', questionId);
        if (error) throw error;
      }
      alert(`성공적으로 ${shouldPublish ? '공개' : '비공개'} 처리되었습니다.`);
    } catch (err) {
      // `any` 대신 `unknown` 타입을 안전하게 처리
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`오류가 발생했습니다: ${errorMessage}`);
      // 실패 시 UI를 원래대로 되돌리기 위해 데이터를 다시 불러옵니다.
      fetchQuestions();
    }
  };

  if (isLoading) return <p className="text-center py-8">문의 목록을 불러오는 중...</p>;
  if (error) return <p className="text-center text-red-500 py-8">오류: {error}</p>;
  if (!isLoading && questions.length === 0) return <p className="text-center py-8">문의 내역이 없습니다.</p>;

  return (
    <div className="container mx-auto p-0 md:p-4">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">헬프 상담게시판 관리</h1>
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 responsive-table">
          <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제목</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작성자</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">공개 여부</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">문의일</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
          </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 md:divide-y-0">
          {questions.map((q) => (
            <tr key={q.id}>
              <td data-label="제목" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                <Link href={`/admin/help-desk/${q.id}`} className="hover:text-indigo-600">
                  {q.title || '내용 없음'}
                </Link>
              </td>
              <td data-label="작성자" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{q.user_name || '익명'}</td>
              <td data-label="상태" className="px-6 py-4 whitespace-nowrap text-sm">
                {q.is_answered
                  ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">답변 완료</span>
                  : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">답변 대기</span>
                }
              </td>
              <td data-label="공개 여부" className="px-6 py-4 whitespace-nowrap text-sm">
                <select
                  value={String(q.is_published_as_crime_case)}
                  onChange={(e) => handlePublishChange(q.id, e)}
                  className={`border rounded-md p-1 text-xs ${q.is_published_as_crime_case ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                >
                  <option value="false">비공개</option>
                  <option value="true">공개</option>
                </select>
              </td>
              <td data-label="문의일" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(q.created_at).toLocaleDateString()}</td>
              <td data-label="작업" className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <Link href={`/admin/help-desk/${q.id}`} className="text-indigo-600 hover:text-indigo-900">
                  답변하기
                </Link>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
