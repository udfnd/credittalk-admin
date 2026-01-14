'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Event {
  id: number;
  title: string;
  entry_start_at: string;
  entry_end_at: string;
  winner_announce_at: string;
  winner_count: number;
  status: string;
  is_published: boolean;
  created_at: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: '초안', color: 'bg-gray-100 text-gray-800' },
  active: { label: '진행중', color: 'bg-green-100 text-green-800' },
  closed: { label: '마감', color: 'bg-yellow-100 text-yellow-800' },
  announced: { label: '발표완료', color: 'bg-purple-100 text-purple-800' },
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말로 이 이벤트를 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      fetchEvents();
    } catch (err) {
      alert('삭제 실패: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    }
  };

  const handleTogglePublish = async (event: Event) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ is_published: !event.is_published })
        .eq('id', event.id);
      if (error) throw error;
      fetchEvents();
    } catch (err) {
      alert('상태 변경 실패: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      fetchEvents();
    } catch (err) {
      alert('상태 변경 실패: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">에러: {error}</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">이벤트 관리</h1>
        <Link
          href="/admin/events/create"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          + 새 이벤트
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          등록된 이벤트가 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  제목
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  응모 기간
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  발표일
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                  당첨인원
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                  상태
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                  공개
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {events.map((event) => {
                const status = statusLabels[event.status] || statusLabels.draft;
                return (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="text-indigo-600 hover:underline font-medium"
                      >
                        {event.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(event.entry_start_at)} ~{' '}
                      {formatDate(event.entry_end_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(event.winner_announce_at)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {event.winner_count}명
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={event.status}
                        onChange={(e) =>
                          handleStatusChange(event.id, e.target.value)
                        }
                        className={`text-xs px-2 py-1 rounded-full border-0 ${status.color}`}
                      >
                        <option value="draft">초안</option>
                        <option value="active">진행중</option>
                        <option value="closed">마감</option>
                        <option value="announced">발표완료</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleTogglePublish(event)}
                        className={`px-3 py-1 rounded-full text-xs ${
                          event.is_published
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {event.is_published ? '공개' : '비공개'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <Link
                          href={`/admin/events/${event.id}/entries`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          응모자
                        </Link>
                        <Link
                          href={`/admin/events/${event.id}`}
                          className="text-gray-600 hover:underline text-sm"
                        >
                          수정
                        </Link>
                        <button
                          onClick={() => handleDelete(event.id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
