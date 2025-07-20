// src/app/admin/reviews/create/page.tsx
import ReviewForm from '@/components/ReviewForm';

export default function CreateReviewPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">새 후기 작성</h1>
      <ReviewForm />
    </div>
  );
}
