import NoticeForm from '@/components/NoticeForm';

export default function ManageNoticesPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">공지사항</h1>
      <NoticeForm />
      {/* 여기에 기존 공지사항 목록을 표시하는 컴포넌트를 추가할 수 있습니다. */}
    </div>
  );
}
