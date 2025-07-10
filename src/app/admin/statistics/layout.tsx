// src/app/admin/statistics/layout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function StatisticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navLinks = [
    { href: '/admin/statistics/sign-ups', label: '회원가입 통계' },
    { href: '/admin/statistics/active-users', label: '현재 접속자' },
    { href: '/admin/statistics/phone-numbers', label: '대포폰 번호 통계' },
    { href: '/admin/statistics/bank-accounts', label: '대포통장 계좌 통계' },
    { href: '/admin/statistics/login-logs', label: '접속자 통계' },
    { href: '/admin/statistics/page-views', label: '게시판별 접속자' },
    { href: '/admin/statistics/crime-summary', label: '금융범죄 사기 통계' },
  ];

  return (
    <div className="container mx-auto p-0 md:p-4">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">통계 관리</h1>
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-4 overflow-x-auto pb-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap px-3 py-2 font-medium text-sm rounded-md ${
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
