// src/app/admin/users/sign-up-source/page.tsx
'use client';

import { useEffect, useState } from 'react';
import AdminUserLayout from '@/components/AdminUserLayout';

interface UserSignUpSource {
  id: number;
  name: string;
  email: string;
  sign_up_source: string;
  created_at: string;
}

export default function SignUpSourcePage() {
  const [users, setUsers] = useState<UserSignUpSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/admin/users?source=true');
        if (!response.ok) {
          throw new Error('가입 경로 정보를 불러오는 데 실패했습니다.');
        }
        const data = await response.json();
        setUsers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입 경로</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입일</th>
            </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.sign_up_source === 'naver' ? 'bg-green-100 text-green-800' :
                          user.sign_up_source === 'kakao' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.sign_up_source || '일반'}
                    </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(user.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminUserLayout>
  );
}
