// src/app/admin/statistics/sign-ups/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SignUpStat {
  date: string;
  count: number;
}

interface ChartData extends SignUpStat {
  total: number;
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

  // 누적 가입자 수 계산
  const chartData = useMemo(() => {
    const sortedStats = [...stats].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let cumulativeCount = 0;
    return sortedStats.map(stat => {
      cumulativeCount += stat.count;
      return {
        date: stat.date,
        count: stat.count,
        total: cumulativeCount,
      };
    });
  }, [stats]);

  if (isLoading) return <p>로딩 중...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">총 회원가입자 추이</h2>
        <div className="bg-white shadow-md rounded-lg p-6 h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" name="누적 가입자 수" stroke="#8884d8" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">일일 가입자 수</h2>
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
      </div>
    </div>
  );
}
