// src/app/admin/layout.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
        } transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:flex-shrink-0`}
      >
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">크레디톡 어드민</h1>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden text-white"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <nav>
          <ul className="space-y-4">
            <li>
              <Link href="/admin" onClick={() => setIsSidebarOpen(false)} className="block py-2 px-3 rounded hover:bg-gray-700 hover:text-indigo-300 transition-colors duration-200">
                홈
              </Link>
            </li>
            <li>
              <Link href="/admin/notices" onClick={() => setIsSidebarOpen(false)} className="block py-2 px-3 rounded hover:bg-gray-700 hover:text-indigo-300 transition-colors duration-200">
                공지사항 작성
              </Link>
            </li>
            <li>
              <Link href="/admin/incident-photos" onClick={() => setIsSidebarOpen(false)} className="block py-2 px-3 rounded hover:bg-gray-700 hover:text-indigo-300 transition-colors duration-200">
                사건 사진자료 작성
              </Link>
            </li>
            <li>
              <Link href="/admin/reports" onClick={() => setIsSidebarOpen(false)} className="block py-2 px-3 rounded hover:bg-gray-700 hover:text-indigo-300 transition-colors duration-200">
                신고 분석 및 관리
              </Link>
            </li>
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
          <span className="text-xl font-semibold text-gray-800">크레디톡</span>
        </header>

        <main className="flex-1 p-6 md:p-10 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
