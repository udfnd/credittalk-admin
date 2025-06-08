// src/app/admin/users/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface UserProfile {
  id: number;
  created_at: string;
  name: string;
  phone_number: string;
  job_type: string;
  auth_user_id: string;
  is_admin: boolean;
}

export default function ManageUsersPage() {
  const supabase = createClientComponentClient();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);

      // 관리자는 모든 사용자 정보를 조회해야 하므로 service_role을 사용하는 RPC를 만들거나,
      // API 라우트를 통해 가져오는 것이 안전합니다.
      // 여기서는 RLS를 우회할 수 있는 'users' 테이블 직접 조회를 시도합니다.
      // (관리자용 RLS 정책이 필요할 수 있습니다.)
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error("Error fetching users:", fetchError);
        setError("사용자 목록을 불러오는 데 실패했습니다. 권한을 확인하세요.");
        setUsers([]);
      } else {
        setUsers(data as UserProfile[]);
      }
      setIsLoading(false);
    };
    fetchUsers();
  }, [supabase]);

  const handleDelete = async (userAuthId: string, userName: string) => {
    if (window.confirm(`정말로 '${userName}' 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      try {
        const response = await fetch(`/api/admin/users/${userAuthId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error(await response.text() || 'Failed to delete user.');
        }

        setUsers(users.filter(user => user.auth_user_id !== userAuthId));
        alert('사용자가 성공적으로 삭제되었습니다.');

      } catch (err) {
        console.error(err);
        alert(`오류: ${err instanceof Error ? err.message : '알 수 없는 오류 발생'}`);
      }
    }
  };

  if (isLoading) return <p className="text-center py-8">사용자 목록을 불러오는 중...</p>;
  if (error) return <p className="text-center text-red-500 py-8">오류: {error}</p>;

  return (
    <div className="container mx-auto p-0 md:p-4">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">회원 관리</h1>
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 responsive-table">
          <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">연락처</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">직업군</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">관리자</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입일</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
          </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 md:divide-y-0">
          {users.map(user => (
            <tr key={user.id}>
              <td data-label="이름" className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.name}</td>
              <td data-label="연락처" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.phone_number}</td>
              <td data-label="직업군" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.job_type}</td>
              <td data-label="관리자" className="px-6 py-4 whitespace-nowrap text-sm">
                {user.is_admin ? (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Admin</span>
                ) : (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">User</span>
                )}
              </td>
              <td data-label="가입일" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(user.created_at).toLocaleDateString()}</td>
              <td data-label="작업" className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button
                  onClick={() => handleDelete(user.auth_user_id, user.name)}
                  className="text-red-600 hover:text-red-900"
                  disabled={user.is_admin}
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
