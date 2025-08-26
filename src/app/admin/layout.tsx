// src/app/admin/layout.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation'; // usePathname 훅을 import합니다.

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname(); // 현재 경로를 가져옵니다.

  const navLinks = [
    { href: '/admin', label: '홈' },
    { href: '/admin/notices', label: '공지사항 관리' },
    { href: '/admin/arrest-news', label: '검거소식 관리' },
    { href: '/admin/reviews', label: '후기 관리' },
    { href: '/admin/incident-photos', label: '사건 사진자료 관리' },
    { href: '/admin/new-crime-cases', label: '신종범죄 관리' }, // 추가된 부분
    { href: '/admin/help-desk', label: '헬프 상담게시판 관리' },
    { href: '/admin/users', label: '회원 설정' },
    { href: '/admin/all-posts', label: '통합 게시물 관리' },
    { href: '/admin/posts', label: '커뮤니티 글 관리' },
    { href: '/admin/reports', label: '신고 분석 및 관리' },
    { href: '/admin/statistics/sign-ups', label: '통계 관리' },
    { href: '/admin/push', label: 'PUSH 알림 발송' },
  ];

  return (
    <div className="relative flex min-h-screen bg-gray-100">
      {/* Sidebar Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 p-6 text-white bg-gray-800 shadow-md transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:flex-shrink-0 flex flex-col`}
      >
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">크레딧톡 어드민</h1>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden text-white"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-grow">
          <ul className="space-y-2">
            {navLinks.map((link) => {
              // 현재 경로가 해당 링크로 시작하는지 확인 (하위 경로 활성화를 위해)
              const isActive = link.href === '/admin' ? pathname === link.href : pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`block py-2 px-3 rounded transition-colors duration-200 ${
                      isActive ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700 hover:text-indigo-300'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-auto pt-6">
          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1">
        {/* Top bar for mobile */}
        <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white shadow-md md:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-gray-600"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <span className="text-xl font-semibold text-gray-800">크레딧톡</span>
        </header>

        <main className="flex-1 p-6 md:p-10 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
