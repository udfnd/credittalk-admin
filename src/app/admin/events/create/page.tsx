import EventForm from '@/components/EventForm';

export default function CreateEventPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">새 이벤트 생성</h1>
      <EventForm />
    </div>
  );
}
