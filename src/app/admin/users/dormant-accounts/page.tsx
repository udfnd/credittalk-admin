// src/app/admin/users/dormant-accounts/page.tsx
'use client';

import { useEffect, useState } from 'react';
import AdminUserLayout from '@/components/AdminUserLayout';

interface DormantUser {
  id: number;
  auth_user_id: string;
  name: string;
  email: string;
  last_login_at: string;
  is_dormant: boolean;
}

export default function DormantAccountsPage() {
  const [users, setUsers] = useState<DormantUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDormantUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/users/dormant-accounts');
      if (!response.ok) {
        throw new Error('휴면 계정 정보를 불러오는 데 실패했습니다.');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDormantUsers();
  }, []);

  const handleToggleDormant = async (userId: string, isDormant: boolean) => {
    if (window.confirm(`이 사용자를 ${isDormant ? '활성' : '휴면'} 계정으로 전환하시겠습니까?`)) {
      try {
        const response = await fetch(`/api/admin/users/dormant-accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, is_dormant: !isDormant }),
        });
        if (!response.ok) {
          throw new Error('상태 변경에 실패했습니다.');
        }
        // 상태 변경 성공 후 목록 새로고침
        fetchDormantUsers();
      } catch (err) {
        alert(err instanceof Error ? err.message : '알 수 없는 오류');
      }
    }
  };

  return (
    <AdminUserLayout>
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        {isLoading && <p className="p-4">로딩 중...</p>}
        {error && <p className="p-4 text-red-500">{error}</p>}
        {!isLoading && !error && (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">마지막 로그인</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
            </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : '기록 없음'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {user.is_dormant
                    ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">휴면</span>
                    : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">활성</span>
                  }
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleToggleDormant(user.auth_user_id, user.is_dormant)}
                    className={`px-3 py-1 text-xs rounded-md text-white ${user.is_dormant ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'}`}
                  >
                    {user.is_dormant ? '활성 전환' : '휴면 전환'}
                  </button>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminUserLayout>
  );
}
