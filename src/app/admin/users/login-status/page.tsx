// src/app/admin/users/login-status/page.tsx
'use client';

import { useEffect, useState } from 'react';
import AdminUserLayout from '@/components/AdminUserLayout';

interface LoginLog {
  id: number;
  user_name: string;
  user_email: string;
  login_at: string;
  ip_address: string;
}

export default function LoginStatusPage() {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/admin/users/login-status');
        if (!response.ok) {
          throw new Error('로그인 기록을 불러오는 데 실패했습니다.');
        }
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

  return (
    <AdminUserLayout>
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        {isLoading && <p className="p-4">로딩 중...</p>}
        {error && <p className="p-4 text-red-500">{error}</p>}
        {!isLoading && !error && (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용자 이름</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">로그인 시간</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP 주소</th>
            </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.user_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.user_email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.login_at).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.ip_address}</td>
              </tr>
            ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminUserLayout>
  );
}
