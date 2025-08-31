'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface ScammerDetail {
  id: number;
  category: string;
  nickname: string | null;
  phone_numbers: string[] | null;
  damage_accounts: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
  }[] | null;
}

export default function ScammerDetailsPage() {
  const [details, setDetails] = useState<ScammerDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/statistics/scammer-details', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('사기 정보 목록을 불러오는 데 실패했습니다.');
      const data: ScammerDetail[] = await response.json();
      setDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: number) => {
    if (!confirm('해당 신고를 삭제할까요? (되돌릴 수 없습니다)')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/statistics/scammer-details/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || (json && json.ok === false)) {
        throw new Error((json && json.error) || '삭제에 실패했습니다.');
      }
      // 성공 시 목록 재조회 (또는 낙관적 업데이트로 제거)
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) return <p className="text-center p-8">로딩 중...</p>;
  if (error) return <p className="text-center text-red-500 p-8">{error}</p>;

  return (
    <div className="bg-white shadow-md rounded-lg overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">사기 유형</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">닉네임</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">전화번호</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">계좌번호</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">삭제</th>
        </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
        {details.map((item) => (
          <tr key={item.id}>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
              {/* 사기 유형 클릭 → 분석 페이지로 이동 */}
              <Link
                href={`/admin/reports/${item.id}/analyze`}
                className="text-indigo-600 hover:underline"
              >
                {item.category}
              </Link>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
              {item.nickname || 'N/A'}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
              {item.phone_numbers?.length
                ? item.phone_numbers.map((phone, idx) => <div key={idx}>{phone}</div>)
                : 'N/A'}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
              {item.damage_accounts?.length
                ? item.damage_accounts.map((acc, idx) => (
                  <div key={idx}>
                    {acc.bankName}: {acc.accountNumber}
                  </div>
                ))
                : 'N/A'}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
              <button
                onClick={() => remove(item.id)}
                disabled={deletingId === item.id}
                className="px-3 py-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {deletingId === item.id ? '삭제 중...' : '삭제'}
              </button>
            </td>
          </tr>
        ))}
        {!details.length && (
          <tr>
            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
              표시할 데이터가 없습니다.
            </td>
          </tr>
        )}
        </tbody>
      </table>
    </div>
  );
}
