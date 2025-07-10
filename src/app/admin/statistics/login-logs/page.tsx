// src/app/admin/statistics/login-logs/page.tsx
'use client';

import { useEffect, useState } from 'react';

interface LoginLog {
  name: string;
  email: string;
  login_at: string;
}

export default function LoginLogsPage() {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/admin/statistics/login-logs');
        if (!response.ok) throw new Error('로그인 기록 로딩 실패');
        const data = await response.json();
        setLogs(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, []);

  if (isLoading) return <p>로딩 중...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="bg-white shadow-md rounded-lg overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">로그인 시간</th>
        </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
        {logs.map((log, index) => (
          <tr key={index}>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.name}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.email}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.login_at).toLocaleString()}</td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}
