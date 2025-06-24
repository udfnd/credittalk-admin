// src/app/admin/incident-photos/create/page.tsx
import IncidentPhotoForm from '@/components/IncidentPhotoForm';

export default function CreateIncidentPhotoPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">사건 사진자료 새 글 작성</h1>
      <IncidentPhotoForm />
    </div>
  );
}
