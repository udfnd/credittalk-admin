// src/app/admin/statistics/page-views/page.tsx
'use client';

import { useEffect, useState } from 'react';

interface PageViewStat {
  page: string;
  count: number;
}

// 실제 데이터 형식(Screen Name)과 한국어 이름을 매핑합니다.
const pageNameToKorean: Record<string, string> = {
  'HomeScreen': '홈 화면',
  'NewCrimeCaseListScreen': '신종범죄 목록',
  'HelpDeskListScreen': '헬프데스크 목록',
  'ArrestNewsListScreen': '검거소식 목록',
  'ReviewListScreen': '이용후기 목록',
  'IncidentPhotoListScreen': '사건/사례 목록',
  'CommunityListScreen': '커뮤니티 목록',
  'ReportScreen': '사기 신고 화면',
  // 그 외 필요한 스크린 이름을 여기에 추가합니다.
  // 예시: 'LoginScreen': '로그인 화면'
};

export default function PageViewsStatsPage() {
  const [stats, setStats] = useState<PageViewStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/admin/statistics/page-views');
        if (!response.ok) {
          throw new Error('데이터를 불러오는 데 실패했습니다.');
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // 매핑 객체를 사용하여 영어 스크린 이름을 한국어로 변환하는 함수
  const getKoreanPageName = (pageName: string): string => {
    return pageNameToKorean[pageName] || pageName; // 매핑된 이름이 없으면 원래 이름 반환
  };

  if (isLoading) return <p className="text-center p-8">로딩 중...</p>;
  if (error) return <p className="text-center text-red-500 p-8">{error}</p>;

  return (
    <div className="bg-white shadow-md rounded-lg overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">게시판/화면</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">총 방문 횟수</th>
        </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
        {stats.map((stat) => (
          <tr key={stat.page}>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{getKoreanPageName(stat.page)}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.count} 회</td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}
