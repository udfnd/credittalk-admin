// src/app/admin/statistics/page-views/page.tsx
'use client';

import { useEffect, useState } from 'react';

interface PageViewStat {
  page: string;
  count: number;
}

export default function PageViewsStatsPage() {
  const [stats, setStats] = useState<PageViewStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/admin/statistics/page-views');
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

  if (isLoading) return <p>로딩 중...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="bg-white shadow-md rounded-lg overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">페이지 경로</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">총 방문 횟수</th>
        </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
        {stats.map((stat) => (
          <tr key={stat.page}>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stat.page}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.count} 회</td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}
