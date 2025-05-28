import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton'; // LogoutButton 컴포넌트를 생성해야 합니다.

export default function AdminLayout({
                                      children,
                                    }: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 p-6 text-white bg-gray-800">
        <h1 className="mb-8 text-2xl font-bold">Admin Panel</h1>
        <nav>
          <ul className="space-y-4">
            <li>
              <Link href="/admin" className="hover:text-indigo-300">
                Dashboard
              </Link>
            </li>
            <li>
              <Link href="/admin/notices" className="hover:text-indigo-300">
                Manage Notices
              </Link>
            </li>
            <li>
              <Link href="/admin/incident-photos" className="hover:text-indigo-300">
                Manage Incident Photos
              </Link>
            </li>
            {/* 다른 메뉴 추가 */}
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
