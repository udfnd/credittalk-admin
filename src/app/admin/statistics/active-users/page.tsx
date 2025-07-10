// src/app/admin/statistics/active-users/page.tsx
'use client';

import { useEffect, useState } from 'react';

interface ActiveUser {
  name: string;
  nickname: string;
  phone_number: string;
  last_seen_at: string;
}

export default function ActiveUsersPage() {
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
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

  }, []);

  if (isLoading && users.length === 0) return <p>로딩 중...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="bg-white shadow-md rounded-lg overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">휴대전화</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">마지막 활동</th>
        </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
        {users.map((user) => (
          <tr key={user.phone_number}>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name} ({user.nickname})</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.phone_number}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(user.last_seen_at).toLocaleString()}</td>
          </tr>
        ))}
        </tbody>
      </table>
      {users.length === 0 && !isLoading && <p className="p-4 text-center text-gray-500">현재 활동 중인 사용자가 없습니다.</p>}
    </div>
  );
}
