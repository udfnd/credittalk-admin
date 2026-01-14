import EventForm from '@/components/EventForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditEventPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">이벤트 수정</h1>
      <EventForm eventId={id} />
    </div>
  );
}
