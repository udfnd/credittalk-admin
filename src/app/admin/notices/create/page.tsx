// src/app/admin/notices/create/page.tsx
import NoticeForm from '@/components/NoticeForm';

export default function CreateNoticePage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">공지사항 새 글 작성</h1>
      <NoticeForm />
    </div>
  );
}
