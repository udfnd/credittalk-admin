// src/components/AdminUserLayout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminUserLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const userNavLinks = [
    { href: '/admin/users', label: '전체 회원' },
    { href: '/admin/users/sign-up-source', label: '가입 경로' },
    { href: '/admin/users/login-status', label: '로그인 현황' },
    { href: '/admin/users/dormant-accounts', label: '휴면 계정 관리' },
  ];

  return (
    <div className="container mx-auto p-0 md:p-4">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">회원 설정</h1>
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-4">
          {userNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 font-medium text-sm rounded-md ${
                pathname === link.href
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <main>{children}</main>
    </div>
  );
}
