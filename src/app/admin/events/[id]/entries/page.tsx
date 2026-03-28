'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Entry {
  entry_id: number;
  entry_number: number;
  entry_created_at: string;
  is_winner: boolean;
  user_id: number;
  user_nickname: string;
  user_phone_number: string;
}

interface Event {
  id: number;
  title: string;
  winner_count: number;
  status: string;
  winner_numbers: number[] | null;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function EventEntriesPage({ params }: Props) {
  const { id } = use(params);
  const [event, setEvent] = useState<Event | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [winnerInput, setWinnerInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingWinners, setEditingWinners] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id, title, winner_count, status, winner_numbers')
        .eq('id', id)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      const { data: entriesData, error: entriesError } = await supabase.rpc(
        'get_event_entries_admin',
        { p_event_id: parseInt(id) }
      );

      if (entriesError) throw entriesError;
      setEntries(entriesData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDraw = async () => {
    if (!event) return;

    const confirmMsg = `${event.winner_count}명의 당첨자를 추첨하시겠습니까?\n\n총 응모자: ${entries.length}명`;
    if (!confirm(confirmMsg)) return;

    setDrawing(true);
    try {
      const { data, error } = await supabase.rpc('draw_event_winners', {
        p_event_id: parseInt(id),
      });

      if (error) throw error;

      if (data && data[0]) {
        const result = data[0];
        if (result.success) {
          alert(
            `추첨 완료!\n\n당첨자 수: ${result.winner_count}명\n당첨 번호: ${result.winner_numbers?.join(', ')}`
          );
          fetchData();
        } else {
          alert('추첨 실패: ' + result.message);
        }
      }
    } catch (err) {
      alert('추첨 중 오류 발생: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    } finally {
      setDrawing(false);
    }
  };

  const handleSaveWinnerNumbers = async () => {
    if (!event) return;

    const numbers = winnerInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '')
      .map((s) => parseInt(s))
      .filter((n) => !isNaN(n));

    if (numbers.length === 0) {
      alert('당첨 번호를 입력해주세요.');
      return;
    }

    const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i);
    if (duplicates.length > 0) {
      alert(`중복된 번호가 있습니다: ${[...new Set(duplicates)].join(', ')}`);
      return;
    }

    if (!confirm(`당첨 번호를 [${numbers.join(', ')}](으)로 설정하시겠습니까?`)) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('update_winner_numbers', {
        p_event_id: parseInt(id),
        p_numbers: numbers,
      });

      if (error) throw error;

      if (data && !data.success) {
        alert(data.message || '저장 실패');
        if (data.invalid_numbers) {
          alert(`유효하지 않은 번호: ${data.invalid_numbers.join(', ')}`);
        }
      } else {
        alert(`당첨 번호가 저장되었습니다. (${numbers.length}명)`);
        setEditingWinners(false);
        fetchData();
      }
    } catch (err) {
      alert('저장 중 오류 발생: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    } finally {
      setSaving(false);
    }
  };

  const startEditingWinners = () => {
    const currentWinners = entries
      .filter((e) => e.is_winner)
      .map((e) => e.entry_number)
      .sort((a, b) => a - b);
    setWinnerInput(currentWinners.join(', '));
    setEditingWinners(true);
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

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return '-';
    return phone;
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

  if (!event) {
    return <div className="text-gray-500 p-4">이벤트를 찾을 수 없습니다.</div>;
  }

  const winnerCount = entries.filter((e) => e.is_winner).length;
  const currentWinnerNumbers = entries
    .filter((e) => e.is_winner)
    .map((e) => e.entry_number)
    .sort((a, b) => a - b);

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/admin/events"
          className="text-indigo-600 hover:underline text-sm"
        >
          ← 이벤트 목록으로
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <p className="text-gray-600 mt-1">응모자 관리</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600 mb-2">
            총 응모자: <span className="font-bold">{entries.length}</span>명 /
            당첨 인원: <span className="font-bold">{event.winner_count}</span>명
          </div>
          {event.status !== 'announced' ? (
            <button
              onClick={handleDraw}
              disabled={drawing || entries.length === 0}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {drawing ? '추첨 중...' : '🎲 당첨자 추첨'}
            </button>
          ) : (
            <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-lg">
              ✅ 추첨 완료 (당첨자 {winnerCount}명)
            </div>
          )}
        </div>
      </div>

      {/* 당첨번호 관리 섹션 */}
      {entries.length > 0 && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">당첨번호 관리</h2>
            {!editingWinners && (
              <button
                onClick={startEditingWinners}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                {currentWinnerNumbers.length > 0 ? '수정' : '직접 입력'}
              </button>
            )}
          </div>

          {currentWinnerNumbers.length > 0 && !editingWinners && (
            <div className="flex flex-wrap gap-2">
              {currentWinnerNumbers.map((num) => (
                <span
                  key={num}
                  className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-mono font-medium"
                >
                  #{num}
                </span>
              ))}
            </div>
          )}

          {currentWinnerNumbers.length === 0 && !editingWinners && (
            <p className="text-gray-400 text-sm">
              아직 당첨번호가 설정되지 않았습니다. 추첨을 실행하거나 직접 입력해주세요.
            </p>
          )}

          {editingWinners && (
            <div>
              <div className="mb-2">
                <label className="block text-sm text-gray-600 mb-1">
                  당첨 응모번호 (쉼표로 구분)
                </label>
                <input
                  type="text"
                  value={winnerInput}
                  onChange={(e) => setWinnerInput(e.target.value)}
                  placeholder="예: 3, 15, 27, 42"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
              <p className="text-xs text-gray-400 mb-3">
                유효한 응모번호만 입력 가능합니다. (1 ~ {entries.length})
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveWinnerNumbers}
                  disabled={saving}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button
                  onClick={() => setEditingWinners(false)}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
          아직 응모자가 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                  응모번호
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  닉네임
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  연락처
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  응모일
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                  당첨여부
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.map((entry) => (
                <tr
                  key={entry.entry_id}
                  className={`hover:bg-gray-50 ${
                    entry.is_winner ? 'bg-yellow-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-center font-mono font-bold">
                    #{entry.entry_number}
                  </td>
                  <td className="px-4 py-3">{entry.user_nickname || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatPhoneNumber(entry.user_phone_number)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(entry.entry_created_at)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {entry.is_winner ? (
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                        🏆 당첨
                      </span>
                    ) : event.status === 'announced' ? (
                      <span className="text-gray-400 text-sm">미당첨</span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
