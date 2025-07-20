// src/app/admin/help-desk/page.tsx
'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface HelpQuestionFromDB {
  id: number;
  created_at: string;
  title: string;
  author_name: string;
  is_answered: boolean;
}

interface HelpQuestion extends HelpQuestionFromDB {
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

    // 1. 기존 뷰에서 문의 목록을 먼저 가져옵니다.
    const { data: helpData, error: fetchError } = await supabase
      .from('help_questions_with_author')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error("Error fetching questions:", fetchError);
      setError("문의 목록을 불러오는 데 실패했습니다.");
      setIsLoading(false);
      return;
    }

    // 2. new_crime_cases 테이블에서 공개된 문의 ID 목록을 가져옵니다.
    const { data: crimeCases, error: crimeCaseError } = await supabase
      .from('new_crime_cases')
      .select('source_help_question_id')
      .not('source_help_question_id', 'is', null);

    if (crimeCaseError) {
      console.error("Error fetching published cases:", crimeCaseError);
      setError("공개된 사례 정보를 불러오는 데 실패했습니다.");
      setIsLoading(false);
      return;
    }

    const publishedQuestionIds = new Set(crimeCases.map(c => c.source_help_question_id));

    // 3. 두 데이터를 조합하여 최종 상태를 결정합니다.
    const processedData = helpData.map(q => ({
      ...q,
      is_published_as_crime_case: publishedQuestionIds.has(q.id),
    }));

    setQuestions(processedData as HelpQuestion[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchQuestions();
  }, [supabase]);

  const handlePublishChange = async (questionId: number, event: ChangeEvent<HTMLSelectElement>) => {
    const shouldPublish = event.target.value === 'true';

    try {
      const response = await fetch(`/api/admin/help-desk/${questionId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: shouldPublish }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      // 상태 변경 성공 시, UI를 즉시 업데이트
      setQuestions(prevQuestions =>
        prevQuestions.map(q =>
          q.id === questionId ? { ...q, is_published_as_crime_case: shouldPublish } : q
        )
      );
      alert(`문의가 성공적으로 ${shouldPublish ? '공개' : '비공개'} 처리되었습니다.`);

    } catch (err) {
      alert(`오류가 발생했습니다: ${err instanceof Error ? err.message : 'Unknown error'}`);
      // 실패 시 원래 상태로 되돌리기 위해 목록을 다시 불러옵니다.
      fetchQuestions();
    }
  };


  if (isLoading) return <p className="text-center py-8">문의 목록을 불러오는 중...</p>;
  if (error) return <p className="text-center text-red-500 py-8">오류: {error}</p>;

  return (
    <div className="container mx-auto p-0 md:p-4">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">고객 문의 관리</h1>
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
          {questions.map(q => (
            <tr key={q.id}>
              <td data-label="제목" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{q.title}</td>
              <td data-label="작성자" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{q.author_name || 'N/A'}</td>
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
