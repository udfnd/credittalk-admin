// src/app/admin/statistics/scammer-details/page.tsx
'use client';

import { useEffect, useState } from 'react';

// API 응답 데이터 타입 정의
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

  useEffect(() => {
    const fetchDetails = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/admin/statistics/scammer-details');
        if (!response.ok) {
          throw new Error('사기 정보 목록을 불러오는 데 실패했습니다.');
        }
        const data = await response.json();
        setDetails(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetails();
  }, []);

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
        </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
        {details.map((item) => (
          <tr key={item.id}>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.category}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.nickname || 'N/A'}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {item.phone_numbers && item.phone_numbers.length > 0
                ? item.phone_numbers.map((phone, index) => <div key={index}>{phone}</div>)
                : 'N/A'}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {item.damage_accounts && item.damage_accounts.length > 0
                ? item.damage_accounts.map((acc, index) => (
                  <div key={index}>
                    {acc.bankName}: {acc.accountNumber}
                  </div>
                ))
                : 'N/A'}
            </td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}
