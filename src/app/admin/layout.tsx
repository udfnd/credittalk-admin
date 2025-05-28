import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';

export default function AdminLayout({children}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 p-6 text-white bg-gray-800">
        <h1 className="mb-8 text-2xl font-bold">크레디톡 어드민</h1>
        <nav>
          <ul className="space-y-4">
            <li>
              <Link href="/admin" className="hover:text-indigo-300">
                홈
              </Link>
            </li>
            <li>
              <Link href="/admin/notices" className="hover:text-indigo-300">
                공지사항 작성
              </Link>
            </li>
            <li>
              <Link href="/admin/incident-photos" className="hover:text-indigo-300">
                사건 사진자료 작성
              </Link>
            </li>
          </ul>
        </nav>
        <div className="mt-auto pt-6">
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-10 bg-gray-100">
        {children}
      </main>
    </div>
  );
}
