// src/components/HelpDeskAnswerForm.tsx
'use client';

import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';

type AnswerFormInputs = { content: string };

interface AnswerFormProps {
  questionId: number;
  initialContent?: string;
  onSuccess: () => void;
  // ③ 작성자 UUID를 prop으로 받기 (있으면 이걸 우선 사용)
  targetAuthUserId?: string;
}

export default function HelpDeskAnswerForm({
                                             questionId,
                                             initialContent = '',
                                             onSuccess,
                                             targetAuthUserId, // ← 추가
                                           }: AnswerFormProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<AnswerFormInputs>({ defaultValues: { content: initialContent } });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const onSubmit: SubmitHandler<AnswerFormInputs> = async (data) => {
    setMessage(null);
    try {
      // 1) 답변 저장
      const res = await fetch(`/api/admin/help-desk/${questionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // ← 세션 쿠키 포함(중요)
        body: JSON.stringify({ content: data.content }),
      });
      if (!res.ok) throw new Error(await res.text());

      // 2) 저장 성공 → 작성자에게 푸시 알림 (실패해도 답변 저장은 유지)
      try {
        await fetch('/api/push/notify-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // ← 관리자 세션 필요
          body: JSON.stringify({
            title: '1:1 문의 답변이 등록되었습니다',
            body: '앱에서 답변을 확인해 주세요.',
            data: { screen: 'HelpDeskDetail', params: { questionId } },
            // ④ authUserId가 있으면 그걸 우선 사용, 없으면 helpdeskId로 폴백
            target: targetAuthUserId
              ? { authUserId: targetAuthUserId }
              : { helpdeskId: Number(questionId) },
          }),
        });
      } catch (pushErr) {
        console.warn('[push] notify-user failed:', pushErr);
      }

      setMessage({ type: 'success', text: '답변이 성공적으로 등록되었습니다.' });
      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setMessage({ type: 'error', text: `오류: ${errorMessage}` });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 p-6 bg-gray-50 rounded-lg shadow-inner">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        {initialContent ? '답변 수정' : '답변 작성'}
      </h3>
      {message && (
        <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}
      <div>
        <label htmlFor="content" className="sr-only">답변 내용</label>
        <textarea
          id="content"
          rows={8}
          {...register('content', { required: '답변 내용을 입력해주세요.' })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900"
          placeholder="고객에게 보여질 답변을 입력하세요..."
        />
        {errors.content && <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>}
      </div>
      <div className="mt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? '등록 중...' : '답변 등록하기'}
        </button>
      </div>
    </form>
  );
}
