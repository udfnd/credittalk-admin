// src/app/admin/statistics/phone-numbers/page.tsx
'use client';

import { useEffect, useState } from 'react';

interface PhoneNumberStat {
  phone_number: string;
  report_count: number;
}

export default function PhoneNumbersStatsPage() {
  const [stats, setStats] = useState<PhoneNumberStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/admin/statistics/phone-numbers');
        if (!response.ok) {
          throw new Error('데이터를 불러오는 데 실패했습니다.');
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) return <p className="text-center py-8">로딩 중...</p>;
  if (error) return <p className="text-center text-red-500 py-8">{error}</p>;

  return (
    <div className="bg-white shadow-md rounded-lg overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 responsive-table">
        <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">전화번호</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">총 신고 횟수</th>
        </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 md:divide-y-0">
        {stats.map((stat) => (
          <tr key={stat.phone_number}>
            <td data-label="전화번호" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stat.phone_number}</td>
            <td data-label="총 신고 횟수" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.report_count} 회</td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}
