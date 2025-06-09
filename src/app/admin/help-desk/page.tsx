// src/app/admin/help-desk/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface HelpQuestion {
  id: number;
  created_at: string;
  title: string;
  author_name: string;
  is_answered: boolean;
}

export default function ManageHelpDeskPage() {
  const supabase = createClientComponentClient();
  const [questions, setQuestions] = useState<HelpQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      // RLS 정책에 따라 모든 사용자가 질문을 볼 수 있으므로 client-side에서 호출 가능
      // 작성자 이름을 가져오기 위해 생성한 뷰를 사용합니다.
      const { data, error: fetchError } = await supabase
        .from('help_questions_with_author')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error("Error fetching questions:", fetchError);
        setError("문의 목록을 불러오는 데 실패했습니다.");
      } else {
        setQuestions(data as HelpQuestion[]);
      }
      setIsLoading(false);
    };
    fetchQuestions();
  }, [supabase]);

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
