// src/app/admin/reports/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'; // 클라이언트 컴포넌트용 클라이언트

interface ReportSummary {
  id: number;
  category: string;
  created_at: string;
  name: string | null; // 복호화된 이름
  analysis_result: string | null;
}

export default function ReportListPage() {
  const supabase = createClientComponentClient(); // 클라이언트 컴포넌트용 클라이언트 생성
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      setError(null);
      // 관리자는 모든 정보를 봐야 하므로, RLS를 우회하거나 관리자 권한으로 모든 데이터를 가져오는
      // RPC 함수 또는 뷰를 사용하는 것이 좋습니다.
      // 여기서는 'admin_scammer_reports_view'를 사용한다고 가정합니다.
      // 이 뷰는 이미 복호화된 데이터를 반환해야 합니다. (decrypt_secret 함수 사용)
      const { data, error: fetchError } = await supabase
        .from('admin_scammer_reports_view') // 생성한 관리자용 뷰 사용
        .select('id, category, created_at, name, analysis_result')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error("Error fetching reports:", fetchError);
        setError(fetchError.message);
        setReports([]);
      } else if (data) {
        setReports(data as ReportSummary[]);
      }
      setIsLoading(false);
    };
    fetchReports();
  }, [supabase]);

  if (isLoading) return <p className="text-center py-8">신고 목록을 불러오는 중...</p>;
  if (error) return <p className="text-center text-red-500 py-8">오류: {error}</p>;

  return (
    <div className="container mx-auto p-0 md:p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">사기 신고 관리</h1>
        {/* 필요한 경우 새로고침 버튼 등 추가 */}
      </div>
      {reports.length === 0 ? (
        <p>등록된 신고가 없습니다.</p>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 responsive-table">
            <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">카테고리</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">신고일</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">분석 결과</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
            </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 md:divide-y-0">
            {reports.map(report => (
              <tr key={report.id}>
                <td data-label="ID" className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{report.id}</td>
                <td data-label="이름" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{report.name || 'N/A'}</td>
                <td data-label="카테고리" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{report.category}</td>
                <td data-label="신고일" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(report.created_at).toLocaleDateString()}</td>
                <td data-label="분석 결과" className="px-6 py-4 whitespace-nowrap text-sm">
                  {report.analysis_result ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {report.analysis_result}
                      </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        미분석
                      </span>
                  )}
                </td>
                <td data-label="작업" className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Link href={`/admin/reports/${report.id}/analyze`} className="text-indigo-600 hover:text-indigo-900">
                    분석/수정
                  </Link>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
