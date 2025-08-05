// src/components/CommentForm.tsx
'use client';

import { useState } from 'react';

interface CommentFormProps {
  postId: number;
  boardType: string;
  onCommentSubmit: () => void; // 성공 시 부모에게 알리기 위한 콜백
}

export default function CommentForm({ postId, boardType, onCommentSubmit }: CommentFormProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async () => {
    if (!content.trim()) {
      setMessage({ type: 'error', text: '댓글 내용을 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: postId,
          boardType: boardType,
          content: content,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || '댓글 작성에 실패했습니다.');
      }

      setContent('');
      onCommentSubmit(); // 부모 컴포넌트에 성공 알림

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setMessage({ type: 'error', text: `오류: ${errorMessage}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 bg-gray-50 border-t border-indigo-200">
      {message && (
        <p className={`text-sm mb-2 ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message.text}
        </p>
      )}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="관리자 권한으로 댓글을 작성합니다..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          disabled={isSubmitting}
        />
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 flex-shrink-0 disabled:opacity-50"
        >
          {isSubmitting ? '등록 중...' : '답글 등록'}
        </button>
      </div>
    </div>
  );
}
