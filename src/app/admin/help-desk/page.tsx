// /src/app/admin/help-desk/page.tsx
'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// 최종적으로 UI에 표시될 데이터 타입
interface HelpQuestion {
  id: number;
  created_at: string;
  title: string | null;
  case_summary: string | null; // case_summary 추가
  is_answered: boolean;
  author_name: string | null;
  is_published_as_crime_case: boolean;
}

export default function ManageHelpDeskPage() {
  const supabase = createClientComponentClient();
  const [questions, setQuestions] = useState<HelpQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. `help_questions_with_author` 뷰를 사용하여 기본 데이터를 안정적으로 가져옵니다.
      //    (단, is_answered, case_summary는 없으므로 별도로 가져와야 합니다)
      const { data: viewData, error: viewError } = await supabase
        .from('help_questions_with_author')
        .select('id, created_at, title, author_name')
        .order('created_at', { ascending: false });

      if (viewError) throw viewError;
      if (!viewData) {
        setQuestions([]);
        setIsLoading(false);
        return;
      }

      const questionIds = viewData.map(q => q.id);

      // 2. недостающие данные (`case_summary`, 공개 여부, 답변 여부)를 별도로 가져옵니다.
      // 2-1. `case_summary` 가져오기
      const { data: summaryData, error: summaryError } = await supabase
        .from('help_questions')
        .select('id, case_summary')
        .in('id', questionIds);
      if (summaryError) throw summaryError;
      const summaryMap = new Map(summaryData.map(item => [item.id, item.case_summary]));

      // 2-2. 공개 여부(new_crime_cases) 정보 가져오기
      const { data: crimeCases, error: crimeCaseError } = await supabase
        .from('new_crime_cases')
        .select('source_help_question_id')
        .in('source_help_question_id', questionIds);
      if (crimeCaseError) throw crimeCaseError;
      const publishedQuestionIds = new Set(crimeCases.map(c => c.source_help_question_id));

      // 2-3. 답변 여부(admin comments) 정보 가져오기
      const { data: adminComments, error: commentsError } = await supabase
        .from('help_desk_comments')
        .select('question_id, users!inner(is_admin)')
        .eq('users.is_admin', true)
        .in('question_id', questionIds);
      if (commentsError) throw commentsError;
      const answeredQuestionIds = new Set(adminComments.map(c => c.question_id));

      // 3. 모든 데이터를 안전하게 조합합니다.
      const processedData = viewData.map(q => ({
        ...q,
        case_summary: summaryMap.get(q.id) || null,
        is_published_as_crime_case: publishedQuestionIds.has(q.id),
        is_answered: answeredQuestionIds.has(q.id),
      }));

      setQuestions(processedData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      console.error("Error fetching questions:", errorMessage);
      setError("문의 목록을 불러오는 데 실패했습니다. 콘솔 로그를 확인하세요.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [supabase]);

  const handlePublishChange = async (questionId: number, event: ChangeEvent<HTMLSelectElement>) => {
    const shouldPublish = event.target.value === 'true';

    setQuestions(prev =>
      prev.map(q =>
        q.id === questionId ? { ...q, is_published_as_crime_case: shouldPublish } : q
      )
    );

    const { error: rpcError } = shouldPublish
      ? await supabase.from('new_crime_cases').insert({ source_help_question_id: questionId })
      : await supabase.from('new_crime_cases').delete().eq('source_help_question_id', questionId);

    if (rpcError) {
      alert(`오류가 발생했습니다: ${rpcError.message}`);
      fetchQuestions();
    } else {
      alert(`문의가 성공적으로 ${shouldPublish ? '공개' : '비공개'} 처리되었습니다.`);
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
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제목 (사건 개요)</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작성자</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">공개 여부</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">문의일</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
          </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 md:divide-y-0">
          {questions.map(q => (
            <tr key={q.id}>
              <td data-label="제목" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                <Link href={`/admin/help-desk/${q.id}`} className="hover:text-indigo-600">
                  {q.case_summary || q.title || '내용 없음'}
                </Link>
              </td>
              <td data-label="작성자" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{q.author_name}</td>
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
