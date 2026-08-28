'use client';

import AdminUserLayout from '@/components/AdminUserLayout';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  PhoneXMarkIcon,
  UserMinusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface BlockActor {
  authUserId: string;
  name: string;
}

interface BlockedUserListItem {
  id: string;
  blockedUserId: string | null;
  bannedPhoneId: number | null;
  name: string | null;
  nickname: string | null;
  phoneNumber: string | null;
  blockedAt: string | null;
  blockedBy: BlockActor[];
  reason: string | null;
  accountBlockActive: boolean;
  phoneBanActive: boolean;
  profileExists: boolean;
}

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function displayName(item: BlockedUserListItem) {
  return item.nickname || item.name || '프로필 없는 사용자';
}

function formatDate(value: string | null) {
  if (!value) return '기록 없음';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '기록 없음' : dateFormatter.format(date);
}

function formatPhoneNumber(value: string | null) {
  if (!value) return '전화번호 없음';

  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  return value;
}

export default function BlockedUsersPage() {
  const [items, setItems] = useState<BlockedUserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] =
    useState<BlockedUserListItem | null>(null);
  const [isUnblocking, setIsUnblocking] = useState(false);
  const [unblockError, setUnblockError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchBlockedUsers = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/admin/users/blocked', {
        cache: 'no-store',
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload &&
          typeof payload === 'object' &&
          'error' in payload &&
          typeof payload.error === 'string'
            ? payload.error
            : '차단 목록을 불러오지 못했습니다.';
        throw new Error(message);
      }

      if (
        !payload ||
        typeof payload !== 'object' ||
        !('items' in payload) ||
        !Array.isArray(payload.items)
      ) {
        throw new Error('차단 목록 응답 형식이 올바르지 않습니다.');
      }

      setItems(payload.items as BlockedUserListItem[]);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : '차단 목록을 불러오지 못했습니다.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  useEffect(() => {
    if (!selectedItem) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isUnblocking) setSelectedItem(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isUnblocking, selectedItem]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ko-KR');
    if (!query) return items;

    const queryDigits = query.replace(/\D/g, '');
    return items.filter((item) => {
      const textFields = [
        item.name,
        item.nickname,
        item.phoneNumber,
        item.reason,
        item.blockedUserId,
        ...item.blockedBy.map((actor) => actor.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('ko-KR');
      const phoneDigits = item.phoneNumber?.replace(/\D/g, '') ?? '';

      return (
        textFields.includes(query) ||
        (queryDigits.length > 0 && phoneDigits.includes(queryDigits))
      );
    });
  }, [items, searchQuery]);

  const summary = useMemo(
    () => ({
      total: items.length,
      accountBlocks: items.filter((item) => item.accountBlockActive).length,
      phoneBans: items.filter((item) => item.phoneBanActive).length,
      missingProfiles: items.filter((item) => !item.profileExists).length,
    }),
    [items],
  );

  const handleUnblock = async () => {
    if (!selectedItem) return;

    setIsUnblocking(true);
    setUnblockError(null);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/users/blocked', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockedUserId: selectedItem.blockedUserId,
          bannedPhoneId: selectedItem.bannedPhoneId,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload &&
          typeof payload === 'object' &&
          'error' in payload &&
          typeof payload.error === 'string'
            ? payload.error
            : '차단을 해제하지 못했습니다.';
        throw new Error(message);
      }

      setItems((currentItems) =>
        currentItems.filter((item) => item.id !== selectedItem.id),
      );
      setNotice(`${displayName(selectedItem)}님의 차단을 해제했습니다.`);
      setSelectedItem(null);
    } catch (unblockError) {
      setUnblockError(
        unblockError instanceof Error
          ? unblockError.message
          : '차단을 해제하지 못했습니다.',
      );
    } finally {
      setIsUnblocking(false);
    }
  };

  return (
    <AdminUserLayout>
      <section className="mb-6 overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
        <div className="flex flex-col gap-5 border-l-4 border-red-600 p-5 md:flex-row md:items-center md:justify-between md:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
              <NoSymbolIcon className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <p className="mb-1 text-xs font-bold tracking-[0.16em] text-red-700 uppercase">
                관리자 제재 현황
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-gray-950">
                차단 회원 관리
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                앱 관리자가 설정한 사용자 차단과 전화번호 재가입 금지를 한곳에서
                확인하고 해제합니다.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void fetchBlockedUsers(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:self-center"
          >
            <ArrowPathIcon
              className={`h-5 w-5 ${isRefreshing ? 'motion-safe:animate-spin' : ''}`}
              aria-hidden="true"
            />
            {isRefreshing ? '새로고침 중' : '새로고침'}
          </button>
        </div>
      </section>

      <section
        aria-label="차단 현황"
        className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500">차단 대상</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-950">
            {summary.total.toLocaleString()}
            <span className="ml-1 text-sm font-medium text-gray-500">명</span>
          </p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
          <p className="text-xs font-semibold text-red-700">사용자 차단</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-red-900">
            {summary.accountBlocks.toLocaleString()}
            <span className="ml-1 text-sm font-medium text-red-700">명</span>
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
          <p className="text-xs font-semibold text-amber-700">전화 재가입 금지</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-amber-900">
            {summary.phoneBans.toLocaleString()}
            <span className="ml-1 text-sm font-medium text-amber-700">명</span>
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-semibold text-gray-600">프로필 없음</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">
            {summary.missingProfiles.toLocaleString()}
            <span className="ml-1 text-sm font-medium text-gray-500">명</span>
          </p>
        </div>
      </section>

      <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <ExclamationTriangleIcon
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
          aria-hidden="true"
        />
        <p className="leading-6">
          차단을 해제하면 관리자 차단 기록과 전화번호 재가입 금지가 제거됩니다.
          차단 당시 삭제된 게시글과 댓글은 복구되지 않습니다.
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          <span className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded p-1 text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            aria-label="알림 닫기"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void fetchBlockedUsers(true)}
            className="self-start rounded-md border border-red-300 px-3 py-1.5 font-semibold hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 sm:self-auto"
          >
            다시 시도
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div>
            <h3 className="font-bold text-gray-950">현재 차단 목록</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery
                ? `검색 결과 ${filteredItems.length.toLocaleString()}명`
                : `최근 차단 순으로 ${items.length.toLocaleString()}명`}
            </p>
          </div>
          <label className="relative block w-full md:max-w-sm">
            <span className="sr-only">차단 사용자 검색</span>
            <MagnifyingGlassIcon
              className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="이름, 닉네임, 전화번호, 관리자 검색"
              className="min-h-11 w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-10 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-5" aria-label="차단 목록 불러오는 중">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-16 rounded-lg bg-gray-100 motion-safe:animate-pulse"
              />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
              {searchQuery ? (
                <MagnifyingGlassIcon className="h-7 w-7" aria-hidden="true" />
              ) : (
                <CheckCircleIcon className="h-7 w-7" aria-hidden="true" />
              )}
            </div>
            <h3 className="font-bold text-gray-900">
              {searchQuery ? '검색 결과가 없습니다' : '차단된 사용자가 없습니다'}
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
              {searchQuery
                ? '이름이나 전화번호를 다시 확인하거나 검색어를 지워 주세요.'
                : '관리자가 앱에서 사용자를 차단하면 이 목록에 표시됩니다.'}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                검색 초기화
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="responsive-table min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold tracking-wide text-gray-500">
                    사용자
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-bold tracking-wide text-gray-500">
                    연락처
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-bold tracking-wide text-gray-500">
                    활성 제재
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-bold tracking-wide text-gray-500">
                    차단 관리자
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-bold tracking-wide text-gray-500">
                    차단일
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-bold tracking-wide text-gray-500">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white md:divide-y">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-l-4 border-l-red-500 transition-colors hover:bg-gray-50/80"
                  >
                    <td data-label="사용자" className="px-5 py-4">
                      <div className="flex items-center justify-end gap-3 md:justify-start">
                        <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white md:flex">
                          {displayName(item).slice(0, 1)}
                        </div>
                        <div className="min-w-0 text-right md:text-left">
                          <p className="truncate text-sm font-bold text-gray-950">
                            {displayName(item)}
                          </p>
                          {item.name && item.nickname && (
                            <p className="mt-0.5 truncate text-xs text-gray-500">
                              {item.name}
                            </p>
                          )}
                          {!item.profileExists && (
                            <span className="mt-1 inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600">
                              탈퇴·프로필 없음
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td
                      data-label="연락처"
                      className="px-5 py-4 text-sm text-gray-700"
                    >
                      <span className="font-medium tabular-nums">
                        {formatPhoneNumber(item.phoneNumber)}
                      </span>
                      {item.reason && (
                        <p className="mt-1 max-w-xs text-xs leading-5 text-gray-500">
                          사유: {item.reason}
                        </p>
                      )}
                    </td>
                    <td data-label="활성 제재" className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-1.5 md:justify-start">
                        {item.accountBlockActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                            <UserMinusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                            사용자 차단
                          </span>
                        )}
                        {item.phoneBanActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
                            <PhoneXMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                            전화 재가입 금지
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      data-label="차단 관리자"
                      className="px-5 py-4 text-sm text-gray-600"
                    >
                      {item.blockedBy.length > 0
                        ? item.blockedBy.map((actor) => actor.name).join(', ')
                        : '관리자 기록 없음'}
                    </td>
                    <td
                      data-label="차단일"
                      className="px-5 py-4 text-sm whitespace-nowrap text-gray-600 tabular-nums"
                    >
                      {formatDate(item.blockedAt)}
                    </td>
                    <td data-label="작업" className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setUnblockError(null);
                          setSelectedItem(item);
                        }}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                      >
                        차단 해제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-gray-950/55"
            onClick={() => {
              if (!isUnblocking) setSelectedItem(null);
            }}
            aria-label="차단 해제 확인창 닫기"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unblock-dialog-title"
            aria-describedby="unblock-dialog-description"
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700">
              <UserMinusIcon className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3
              id="unblock-dialog-title"
              className="text-xl font-bold tracking-tight text-gray-950"
            >
              {displayName(selectedItem)}님의 차단을 해제할까요?
            </h3>
            <p
              id="unblock-dialog-description"
              className="mt-3 text-sm leading-6 text-gray-600"
            >
              관리자 차단 기록
              {selectedItem.phoneBanActive ? '과 전화번호 재가입 금지' : ''}를
              제거합니다. 기존에 삭제된 게시글과 댓글은 복구되지 않습니다.
            </p>

            <dl className="mt-5 rounded-xl bg-gray-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500">사용자</dt>
                <dd className="font-semibold text-gray-900">
                  {displayName(selectedItem)}
                </dd>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4">
                <dt className="text-gray-500">전화번호</dt>
                <dd className="font-semibold tabular-nums text-gray-900">
                  {formatPhoneNumber(selectedItem.phoneNumber)}
                </dd>
              </div>
            </dl>

            {unblockError && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-800"
              >
                {unblockError}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                disabled={isUnblocking}
                autoFocus
                className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleUnblock()}
                disabled={isUnblocking}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUnblocking && (
                  <ArrowPathIcon
                    className="h-4 w-4 motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                )}
                {isUnblocking ? '해제 중' : '차단 해제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminUserLayout>
  );
}
