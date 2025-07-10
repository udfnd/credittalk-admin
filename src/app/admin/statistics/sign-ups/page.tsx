// src/app/admin/statistics/sign-ups/page.tsx
'use client';

import { useEffect, useState } from 'react';

interface SignUpStat {
  date: string;
  count: number;
}

export default function SignUpStatsPage() {
  const [stats, setStats] = useState<SignUpStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/admin/statistics/sign-ups');
        if (!response.ok) {
          throw new Error('통계 데이터를 불러오는 데 실패했습니다.');
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
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입자 수</th>
        </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
        {stats.map((stat) => (
          <tr key={stat.date}>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stat.date}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.count} 명</td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}
