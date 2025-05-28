import IncidentPhotoForm from '@/components/IncidentPhotoForm';

export default function ManageIncidentPhotosPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">사건 사진자료</h1>
      <IncidentPhotoForm />
      {/* 여기에 기존 사진 목록 및 관리 기능을 추가할 수 있습니다. */}
    </div>
  );
}
