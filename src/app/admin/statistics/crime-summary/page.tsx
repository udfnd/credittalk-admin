// src/app/admin/statistics/crime-summary/page.tsx
'use client';

import { useEffect, useState } from 'react';

interface CrimeSummary {
  totalReports: number;
  categoryCounts: Record<string, number>;
  monthlyTrends: Record<string, number>;
  damageDistribution: Record<string, number>;
}

const StatCard = ({ title, value }: { title: string; value: string | number }) => (
  <div className="bg-white p-6 rounded-lg shadow">
    <h3 className="text-sm font-medium text-gray-500">{title}</h3>
    <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
  </div>
);

const StatList = ({ title, data }: { title: string; data: Record<string, number>}) => (
  <div className="bg-white p-6 rounded-lg shadow">
    <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>
    <ul className="mt-4 divide-y divide-gray-200">
      {Object.entries(data).map(([key, value]) => (
        <li key={key} className="py-2 flex items-center justify-between">
          <span className="text-sm text-gray-600">{key}</span>
          <span className="text-sm font-semibold text-gray-900">{value.toLocaleString()} 건</span>
        </li>
      ))}
    </ul>
  </div>
);

export default function CrimeSummaryPage() {
  const [summary, setSummary] = useState<CrimeSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/admin/statistics/crime-summary');
        if (!response.ok) throw new Error('데이터 로딩 실패');
        const data = await response.json();
        setSummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSummary();
  }, []);

  if (isLoading) return <p>로딩 중...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!summary) return <p>통계 데이터가 없습니다.</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="총 신고 건수" value={summary.totalReports.toLocaleString()} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <StatList title="카테고리별 신고 건수" data={summary.categoryCounts} />
        </div>
        <div className="lg:col-span-1">
          <StatList title="월별 신고 추이" data={summary.monthlyTrends} />
        </div>
        <div className="lg:col-span-1">
          <StatList title="피해 금액별 분포" data={summary.damageDistribution} />
        </div>
      </div>
    </div>
  );
}
