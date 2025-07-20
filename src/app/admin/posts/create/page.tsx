// src/app/admin/posts/create/page.tsx
import PostForm from '@/components/PostForm';

export default function CreatePostPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">새 커뮤니티 글 작성</h1>
      <PostForm />
    </div>
  );
}
