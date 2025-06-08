// src/app/admin/arrest-news/create/page.tsx
import ArrestNewsForm from '@/components/ArrestNewsForm';

export default function CreateArrestNewsPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">검거소식 새 글 작성</h1>
      <ArrestNewsForm />
    </div>
  );
}
