'use client';

import { useEffect, useState, Fragment, useRef } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CommentForm from '@/components/CommentForm';

interface NewCrimeCase {
  id: number;
  created_at: string;
  title: string;
  method: string;
  is_published: boolean;
  views: number;
  is_pinned: boolean;
}

// ✨ '작업' 메뉴를 위한 드롭다운 컴포넌트 추가
const ActionMenu = ({ item, onPinToggle, onEdit, onDelete, onComment }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 메뉴 외부 클릭 시 닫히도록 하는 로직
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleActionClick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        작업
        <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1" role="menu" aria-orientation="vertical">
            <button onClick={() => handleActionClick(onComment)} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900">답글 달기</button>
            <button onClick={() => handleActionClick(() => onPinToggle(item.id, item.is_pinned))} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900">
              {item.is_pinned ? '고정 해제' : '상단 고정'}
            </button>
            <Link href={`/admin/new-crime-cases/${item.id}/edit`} onClick={() => setIsOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900">수정</Link>
            <button onClick={() => handleActionClick(() => onDelete(item.id))} className="w-full text-left block px-4 py-2 text-sm text-red-700 hover:bg-gray-100 hover:text-red-900">삭제</button>
          </div>
        </div>
      )}
    </div>
  );
};


export default function ManageNewCrimeCasesPage() {
  const supabase = createClientComponentClient();
  const [cases, setCases] = useState<NewCrimeCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCommentFormId, setOpenCommentFormId] = useState<number | null>(null);

  const fetchCases = async () => {
    setIsLoading(true);
    const { data, error: fetchError } = await supabase
      .from('new_crime_cases')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('pinned_at', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError('데이터를 불러오는 데 실패했습니다.');
    } else {
      setCases(data as NewCrimeCase[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCases();
  }, [supabase]);

  const handlePinToggle = async (id: number, currentPinStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'new-crime-cases', id, pin: !currentPinStatus }),
      });
      if (!response.ok) throw new Error('상태 변경에 실패했습니다.');
      await fetchCases();
    } catch (err) {
      alert(err instanceof Error ? err.message : '알 수 없는 오류');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('정말로 이 사례를 삭제하시겠습니까?')) {
      const response = await fetch(`/api/admin/new-crime-cases/${id}`, { method: 'DELETE' });
      if(response.ok) await fetchCases();
      else alert('삭제에 실패했습니다.');
    }
  };

  if (isLoading) return <p className="text-center py-8">목록을 불러오는 중...</p>;
  if (error) return <p className="text-center text-red-500 py-8">오류: {error}</p>;

  return (
    <div className="container mx-auto p-0 md:p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">신종범죄 관리</h1>
        <Link href="/admin/new-crime-cases/create" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          새 사례 작성
        </Link>
      </div>
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 responsive-table">
          <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제목</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">범죄 수법 (요약)</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">조회수</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작성일</th>
            {/* ✨ '작업' 컬럼의 너비를 고정하여 공간을 확보합니다. */}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-28">작업</th>
          </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 md:divide-y-0">
          {cases.map(item => (
            <Fragment key={item.id}>
              <tr className={item.is_pinned ? 'bg-indigo-50' : ''}>
                <td data-label="제목" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {item.is_pinned && <span className="font-bold text-indigo-600">[고정] </span>}
                  <Link href={`/admin/view/new-crime-cases/${item.id}`} className="hover:text-indigo-900">{item.title}</Link>
                </td>
                <td data-label="범죄 수법" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                  {item.method}
                </td>
                <td data-label="상태" className="px-6 py-4 whitespace-nowrap text-sm">
                  {item.is_published
                    ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">게시됨</span>
                    : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">숨김</span>
                  }
                </td>
                <td data-label="조회수" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.views}</td>
                <td data-label="작성일" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(item.created_at).toLocaleDateString()}</td>
                <td data-label="작업" className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {/* ✨ 기존 버튼들을 ActionMenu 컴포넌트로 대체합니다. */}
                  <ActionMenu
                    item={item}
                    onPinToggle={handlePinToggle}
                    onDelete={handleDelete}
                    onComment={() => setOpenCommentFormId(openCommentFormId === item.id ? null : item.id)}
                    onEdit={() => {}} // Link는 ActionMenu 내부에서 처리
                  />
                </td>
              </tr>
              {openCommentFormId === item.id && (
                <tr>
                  <td colSpan={6}>
                    <CommentForm
                      postId={item.id}
                      boardType="new_crime_cases"
                      onCommentSubmit={() => {
                        alert('댓글이 성공적으로 등록되었습니다.');
                        setOpenCommentFormId(null);
                      }}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
