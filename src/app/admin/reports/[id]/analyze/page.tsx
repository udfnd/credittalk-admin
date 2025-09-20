// src/app/admin/reports/[id]/analyze/page.tsx
'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { analysisOptionsData } from '@/lib/analysisOptions';

interface ScammerReport {
  id: number;
  created_at: string;
  category: string;
  description: string | null;
  nickname: string | null;
  reporter_id: string | null;
  reporter_email: string | null;

  damage_amount: number | null;
  no_damage_amount: boolean | null;
  victim_circumstances: string | null;
  detailed_crime_type: string | null;
  damage_path: string | null;
  damaged_item: string | null;

  phone_numbers: string[] | null;
  damage_accounts: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
  }[] | null;
  impersonated_person: string | null;
  impersonated_phone_number: string | null;
  site_name: string | null;

  nickname_evidence_url: string | null;
  traded_item_image_urls: string[] | null;
  illegal_collection_evidence_urls: string[] | null;

  analysis_result: string | null;
  analysis_message: string | null;
  analyzed_at: string | null;
  analyzer_id: string | null;
}

const InfoSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white shadow-md rounded-lg p-6 mb-6">
    <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-gray-800">{title}</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
      {children}
    </div>
  </div>
);

const InfoItem = ({ label, value }: { label: string; value: React.ReactNode | string | null }) => (
  <div>
    <dt className="text-sm font-medium text-gray-500">{label}</dt>
    <dd className="mt-1 text-base text-gray-900 break-words">{value || <span className="text-gray-400">N/A</span>}</dd>
  </div>
);

export default function AnalyzeReportPage() {
  const supabase = createClientComponentClient();
  const params = useParams();
  const reportId = params?.id as string;

  const [report, setReport] = useState<ScammerReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAnalysisResult, setSelectedAnalysisResult] = useState('');
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReportDetails = async () => {
    if (!reportId) return;
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('admin_scammer_reports_view')
      .select('*')
      .eq('id', reportId)
      .single();

    if (fetchError) {
      console.error("Error fetching report details:", fetchError);
      setError(fetchError.message);
      setReport(null);
    } else if (data) {
      const typedData = data as ScammerReport;
      setReport(typedData);
      setSelectedAnalysisResult(typedData.analysis_result || '');

      if (typedData.analysis_result) {
        const categoryOptions =
          analysisOptionsData[typedData.category as keyof typeof analysisOptionsData] || [];
        const preselectedOption =
          categoryOptions.find(opt => opt.result === typedData.analysis_result);
        setAnalysisMessage(typedData.analysis_message || preselectedOption?.message || '');
      } else {
        setAnalysisMessage('');
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReportDetails();
  }, [reportId, supabase]);

  const handleResultChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const resultValue = e.target.value;
    setSelectedAnalysisResult(resultValue);
    if (report?.category) {
      const optionsForCategory =
        analysisOptionsData[report.category as keyof typeof analysisOptionsData] || [];
      const selectedOption = optionsForCategory.find(opt => opt.result === resultValue);
      setAnalysisMessage(selectedOption?.message || '');
    } else {
      setAnalysisMessage('');
    }
  };

  async function notifyReporterSafe() {
    try {
      const pushTitle = '사기 신고 분석이 완료되었습니다';
      const preview = (analysisMessage || selectedAnalysisResult || '').toString().trim();
      const pushBody = preview.length > 120 ? `${preview.slice(0, 117)}…` : preview || '앱에서 결과를 확인해 주세요.';

      const target = report?.reporter_id
        ? { authUserId: report.reporter_id }
        : { reportId: Number(reportId) };

      await fetch('/api/push/notify-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: pushTitle,
          body: pushBody,
          data: { screen: 'MyReports' },
          target,
        }),
      });
    } catch (e) {
      console.warn('[push] notify-user failed:', e);
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAnalysisResult) {
      alert('분석 결과를 선택해주세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/reports/${reportId}/analyze`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          analysis_result: selectedAnalysisResult,
          analysis_message: analysisMessage,
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to update analysis.');
      }

      await notifyReporterSafe();

      alert('분석 결과가 성공적으로 저장되었습니다.');
      await fetchReportDetails();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류 발생';
      alert(`오류: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <p className="text-center py-8">신고 정보를 불러오는 중...</p>;
  if (error) return <p className="text-center text-red-500 py-8">오류: {error}</p>;
  if (!report) return <p className="text-center py-8">신고 정보를 찾을 수 없습니다.</p>;

  const currentAnalysisOptions =
    analysisOptionsData[report.category as keyof typeof analysisOptionsData] || [];

  const allEvidenceUrls = [
    ...(report.nickname_evidence_url ? [report.nickname_evidence_url] : []),
    ...(report.illegal_collection_evidence_urls || []),
    ...(report.traded_item_image_urls || [])
  ].filter(Boolean);


  return (
    <div className="container mx-auto p-0 md:p-4">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">사기 신고 분석 (ID: {report.id})</h1>

      <InfoSection title="핵심 정보">
        <InfoItem label="신고 카테고리" value={<span className="font-bold text-lg text-red-600">{report.category}</span>} />
        <InfoItem label="신고일" value={new Date(report.created_at).toLocaleString()} />
        <InfoItem label="신고자 닉네임" value={report.nickname} />
        <InfoItem label="신고자 이메일" value={report.reporter_email} />
      </InfoSection>

      <InfoSection title="피해 정보">
        <InfoItem label="피해 금액" value={report.damage_amount ? `${report.damage_amount.toLocaleString()}원` : '피해액 없음'} />
        <InfoItem label="세부 피해 유형" value={report.detailed_crime_type} />
        <InfoItem label="피해 경로" value={report.damage_path} />
        <InfoItem label="피해 품목" value={report.damaged_item} />
        <InfoItem label="피해자 특정 정황" value={<p className="whitespace-pre-wrap">{report.victim_circumstances}</p>} />
        <InfoItem label="신고 내용" value={<p className="whitespace-pre-wrap">{report.description}</p>} />
      </InfoSection>

      <InfoSection title="피의자 정보">
        <InfoItem label="연락처" value={report.phone_numbers?.map((p, i) => <div key={i}>{p}</div>)} />
        <InfoItem label="계좌 정보" value={report.damage_accounts?.map((acc, i) => <div key={i}>{acc.bankName} | {acc.accountHolderName} | {acc.accountNumber}</div>)} />
        <InfoItem label="사칭된 인물" value={report.impersonated_person} />
        <InfoItem label="사칭된 연락처" value={report.impersonated_phone_number} />
        <InfoItem label="사이트 명" value={report.site_name} />
      </InfoSection>

      {allEvidenceUrls.length > 0 && (
        <InfoSection title="증거 자료">
          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {allEvidenceUrls.map((url, index) => (
              <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="aspect-w-1 aspect-h-1">
                <img src={url} alt={`증거 자료 ${index + 1}`} className="w-full h-full object-cover rounded-lg shadow-md hover:opacity-80 transition-opacity" />
              </a>
            ))}
          </div>
        </InfoSection>
      )}

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
          disabled={isSubmitting || !selectedAnalysisResult}
          className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isSubmitting ? '저장 중...' : '분석 결과 저장'}
        </button>
      </form>
    </div>
  );
}
