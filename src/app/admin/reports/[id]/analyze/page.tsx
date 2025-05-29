// src/app/admin/reports/[id]/analyze/page.tsx
'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { analysisOptionsData, AnalysisOption } from '@/lib/analysisOptions'; // 경로 확인

// ScammerReport 타입 정의 (실제 테이블 컬럼에 맞춰 확장)
interface ScammerReport {
  id: number;
  created_at: string;
  name: string | null;
  phone_number: string | null;
  national_id: string | null;
  account_number: string | null;
  address: string | null;
  category: string; // 이 값으로 analysisOptionsData의 키를 찾음
  description: string | null;
  ip_address: string | null;
  company_type: string | null;
  scam_report_source: string | null;
  nickname: string | null;
  perpetrator_dialogue_trigger: string | null;
  perpetrator_contact_path: string | null;
  victim_circumstances: string | null;
  traded_item_category: string | null;
  perpetrator_identified: boolean | null;
  analysis_result: string | null;
  analysis_message: string | null;
  analyzed_at: string | null;
  analyzer_id: string | null;
}

export default function AnalyzeReportPage() {
  const supabase = createClientComponentClient();
  const params = useParams();
  const router = useRouter();
  const reportId = params?.id as string;

  const [report, setReport] = useState<ScammerReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAnalysisResult, setSelectedAnalysisResult] = useState('');
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!reportId) {
      setError('Report ID is missing.');
      setIsLoading(false);
      return;
    }

    const fetchReportAndDecrypt = async () => {
      setIsLoading(true);
      setError(null);

      // 관리자이므로 모든 정보를 가져오고, 필요한 필드는 복호화합니다.
      // 실제로는 get_decrypted_report_for_admin RPC 함수를 호출하는 API를 만드는 것이 좋습니다.
      // 여기서는 클라이언트 사이드에서 'admin_scammer_reports_view' (복호화된 뷰)를 사용한다고 가정합니다.
      const { data, error: fetchError } = await supabase
        .from('admin_scammer_reports_view') // 복호화된 데이터가 포함된 뷰 사용
        .select('*')
        .eq('id', reportId)
        .single();

      if (fetchError) {
        console.error("Error fetching report details:", fetchError);
        setError(fetchError.message);
        setReport(null);
      } else if (data) {
        setReport(data as ScammerReport);
        setSelectedAnalysisResult(data.analysis_result || '');
        // 분석 결과가 이미 있다면, 해당 결과에 맞는 메시지를 불러오거나 DB의 메시지 사용
        if (data.analysis_result) {
          const categoryOptions = analysisOptionsData[data.category as keyof typeof analysisOptionsData] || [];
          const preselectedOption = categoryOptions.find(opt => opt.result === data.analysis_result);
          setAnalysisMessage(data.analysis_message || preselectedOption?.message || '');
        } else {
          setAnalysisMessage('');
        }
      }
      setIsLoading(false);
    };

    fetchReportAndDecrypt();
  }, [reportId, supabase]);

  const handleResultChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const resultValue = e.target.value;
    setSelectedAnalysisResult(resultValue);
    if (report?.category) {
      const optionsForCategory = analysisOptionsData[report.category as keyof typeof analysisOptionsData] || [];
      const selectedOption = optionsForCategory.find(opt => opt.result === resultValue);
      setAnalysisMessage(selectedOption?.message || '');
    } else {
      setAnalysisMessage('');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAnalysisResult) { // 메시지는 비워둘 수 있지만 결과는 선택해야 함
      alert('분석 결과를 선택해주세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/reports/${reportId}/analyze`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysis_result: selectedAnalysisResult,
          analysis_message: analysisMessage, // 사용자가 수정한 메시지 포함 가능
        }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update analysis.');
      }
      alert('분석 결과가 성공적으로 저장되었습니다.');
      // router.push('/admin/reports'); // 목록 페이지로 이동하거나 현재 페이지 유지
      // 현재 페이지를 유지하며 업데이트된 정보를 보여주려면 fetchReportAndDecrypt() 다시 호출
      if (reportId) {
        const { data, error: fetchError } = await supabase
          .from('admin_scammer_reports_view')
          .select('*')
          .eq('id', reportId)
          .single();
        if (data) setReport(data as ScammerReport);
      }

    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <p className="text-center py-8">신고 정보를 불러오는 중...</p>;
  if (error) return <p className="text-center text-red-500 py-8">오류: {error}</p>;
  if (!report) return <p className="text-center py-8">신고 정보를 찾을 수 없습니다.</p>;

  const currentAnalysisOptions = analysisOptionsData[report.category as keyof typeof analysisOptionsData] || [];

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">사기 신고 분석 (ID: {report.id})</h1>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-3">신고 정보 요약</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <p><strong>카테고리:</strong> {report.category}</p>
          <p><strong>신고일:</strong> {new Date(report.created_at).toLocaleString()}</p>
          <p><strong>이름:</strong> {report.name || 'N/A'}</p>
          <p><strong>연락처:</strong> {report.phone_number || 'N/A'}</p>
          {/* 필요시 더 많은 정보 표시 */}
          <p className="md:col-span-2"><strong>상세 설명:</strong> {report.description || 'N/A'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">분석 입력</h2>
        <div className="mb-4">
          <label htmlFor="analysisResult" className="block text-sm font-medium text-gray-700 mb-1">
            분석 결과 선택 (카테고리: {report.category})
          </label>
          <select
            id="analysisResult"
            value={selectedAnalysisResult}
            onChange={handleResultChange}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            required
          >
            <option value="">-- 결과 선택 --</option>
            {currentAnalysisOptions.map((opt) => (
              <option key={opt.result} value={opt.result}>
                {opt.result}
              </option>
            ))}
            {currentAnalysisOptions.length === 0 && (
              <option value="" disabled>해당 카테고리에 대한 분석 옵션이 없습니다.</option>
            )}
          </select>
        </div>

        <div className="mb-6">
          <label htmlFor="analysisMessage" className="block text-sm font-medium text-gray-700 mb-1">
            분석 메시지 (필요시 수정)
          </label>
          <textarea
            id="analysisMessage"
            rows={5}
            value={analysisMessage}
            onChange={(e) => setAnalysisMessage(e.target.value)}
            className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !selectedAnalysisResult} // 결과가 선택되지 않으면 비활성화
          className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isSubmitting ? '저장 중...' : '분석 결과 저장'}
        </button>
      </form>
    </div>
  );
}
