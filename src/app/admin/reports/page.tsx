// src/app/admin/reports/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// 스키마의 모든 컬럼을 포함하도록 인터페이스 확장
interface ReportSummary {
  id: number;
  created_at: string;
  category: string;
  description: string | null;
  nickname: string | null;
  analysis_result: string | null;
  phone_numbers: string[] | null;
  damage_accounts: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
  }[] | null;
  // 추가적으로 표시할 수 있는 유용한 필드들
  damage_amount: number | null;
  site_name: string | null;
  reporter_email: string | null;
}

export default function ReportListPage() {
  const supabase = createClientComponentClient();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      setError(null);

      // 뷰의 모든 컬럼을 가져오도록 `select('*')` 사용
      const { data, error: fetchError } = await supabase
        .from('admin_scammer_reports_view')
        .select('*')
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

  // 복잡한 데이터를 보기 좋게 표시하는 헬퍼 컴포넌트
  const renderArray = (items: string[] | undefined | null) => {
    if (!items || items.length === 0) return 'N/A';
    return items.map((item, index) => <div key={index}>{item}</div>);
  };

  const renderAccounts = (accounts: ReportSummary['damage_accounts']) => {
    if (!accounts || accounts.length === 0) return 'N/A';
    return accounts.map((acc, index) => (
      <div key={index} className="text-xs">
        {acc.bankName}: {acc.accountNumber} ({acc.accountHolderName})
      </div>
    ));
  };

  return (
    <div className="container mx-auto p-0 md:p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">사기 신고 관리</h1>
      </div>
      {reports.length === 0 ? (
        <p>등록된 신고가 없습니다.</p>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">신고일</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">신고자(닉네임)</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">카테고리</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">피해 금액</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가해자 연락처</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가해자 계좌 정보</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">분석결과</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
            </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
            {reports.map(report => (
              <tr key={report.id}>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(report.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">{report.nickname || 'N/A'}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{report.category}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{report.damage_amount ? `${report.damage_amount.toLocaleString()}원` : '피해액 없음'}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{renderArray(report.phone_numbers)}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{renderAccounts(report.damage_accounts)}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
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
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
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
