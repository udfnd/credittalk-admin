// src/app/admin/layout.tsx
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton'; // LogoutButton 경로는 실제 프로젝트에 맞게 확인

export default function AdminLayout({children}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 p-6 text-white bg-gray-800 shadow-md">
        <h1 className="mb-8 text-2xl font-bold">크레디톡 어드민</h1>
        <nav>
          <ul className="space-y-4">
            <li>
              <Link href="/admin" className="block py-2 px-3 rounded hover:bg-gray-700 hover:text-indigo-300 transition-colors duration-200">
                홈
              </Link>
            </li>
            <li>
              <Link href="/admin/notices" className="block py-2 px-3 rounded hover:bg-gray-700 hover:text-indigo-300 transition-colors duration-200">
                공지사항 작성
              </Link>
            </li>
            <li>
              <Link href="/admin/incident-photos" className="block py-2 px-3 rounded hover:bg-gray-700 hover:text-indigo-300 transition-colors duration-200">
                사건 사진자료 작성
              </Link>
            </li>
            <li>
              <Link href="/admin/reports" className="block py-2 px-3 rounded hover:bg-gray-700 hover:text-indigo-300 transition-colors duration-200">
                신고 분석 및 관리
              </Link>
            </li>
          </ul>
        </nav>
        <div className="mt-auto pt-6">
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-10 bg-gray-100 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
