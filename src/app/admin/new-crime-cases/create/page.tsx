// src/app/admin/new-crime-cases/create/page.tsx
import NewCrimeCaseForm from '@/components/NewCrimeCaseForm';

export default function CreateNewCrimeCasePage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">신종범죄 새 사례 작성</h1>
      <NewCrimeCaseForm />
    </div>
  );
}
