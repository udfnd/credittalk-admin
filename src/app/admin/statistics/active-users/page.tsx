// src/app/admin/statistics/active-users/page.tsx
'use client';

import { useEffect, useState } from 'react';

interface ActiveUser {
  user_name: string;
  user_email: string;
  login_at: string;
}

export default function ActiveUsersPage() {
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      // 초기 로딩 시에만 true로 설정합니다.
      if (users.length === 0) setIsLoading(true);
      try {
        const response = await fetch('/api/admin/statistics/active-users');
        if (!response.ok) throw new Error('데이터 로딩 실패');
        const data = await response.json();
        setUsers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
    // 10초마다 데이터를 새로고침하여 실시간 성격을 강화합니다.
    const interval = setInterval(fetchUsers, 10000);
    return () => clearInterval(interval);

  }, []); // 최초 마운트 시에만 실행

  if (isLoading) return <p className="text-center p-8">로딩 중...</p>;
  if (error) return <p className="text-center text-red-500 p-8">{error}</p>;

  return (
    <div className="bg-white shadow-md rounded-lg overflow-x-auto">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">현재 접속자 ({users.length}명)</h2>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">최근 접속 시간</th>
        </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
        {users.length > 0 ? users.map((user, index) => (
          <tr key={`${user.user_email}-${index}`}>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.user_name}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.user_email}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(user.login_at).toLocaleString()}</td>
          </tr>
        )) : (
          <tr>
            <td colSpan={3} className="p-4 text-center text-gray-500">현재 활동 중인 사용자가 없습니다.</td>
          </tr>
        )}
        </tbody>
      </table>
    </div>
  );
}
