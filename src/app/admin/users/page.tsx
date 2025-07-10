// src/app/admin/users/page.tsx
'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import AdminUserLayout from '@/components/AdminUserLayout'; // 새로 만든 레이아웃 import

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
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUsers = async (query = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "사용자 목록을 불러오는 데 실패했습니다. 권한을 확인하세요.");
      }

      const data = await response.json();
      setUsers(data as UserProfile[]);

    } catch (err) {
      console.error("Error fetching users:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    fetchUsers(searchQuery);
  };

  const handleDelete = async (userAuthId: string, userName: string) => {
    if (window.confirm(`정말로 '${userName}' 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      try {
        const response = await fetch(`/api/admin/users/${userAuthId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error(await response.text() || 'Failed to delete user.');
        }

        await fetchUsers(searchQuery); // 현재 검색 상태를 유지하며 목록 새로고침
        alert('사용자가 성공적으로 삭제되었습니다.');

      } catch (err) {
        console.error(err);
        alert(`오류: ${err instanceof Error ? err.message : '알 수 없는 오류 발생'}`);
      }
    }
  };

  return (
    // AdminUserLayout으로 전체 컨텐츠를 감쌉니다.
    <AdminUserLayout>
      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름 또는 닉네임으로 검색..."
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            검색
          </button>
        </form>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        {isLoading && <p className="p-4">로딩 중...</p>}
        {error && <p className="p-4 text-red-500">{error}</p>}
        {!isLoading && !error && (
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
                <td data-label="이름" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  <Link href={`/admin/users/${user.auth_user_id}/activity`} className="text-indigo-600 hover:text-indigo-900 hover:underline">
                    {user.name}
                  </Link>
                </td>
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
                    className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={user.is_admin} // 관리자 계정은 삭제 불가
                  >
                    차단
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
