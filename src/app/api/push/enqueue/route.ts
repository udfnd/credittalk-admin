import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { normalizePushPayload } from '@/lib/push/internal';

export const runtime = 'nodejs';

type JobStatus = 'queued' | 'processing' | 'done' | 'failed';
type PushJobRow = {
  id: number;
  status: JobStatus;
  [key: string]: unknown;
};

type EnqueueRequestBody = {
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  audience?: Record<string, unknown> | null;
  targetUserIds?: Array<string | number>;
  imageUrl?: string;
  scheduledAt?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_EXPLICIT_TARGETS = 1000;

async function isAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, user: null };
  const { data, error } = await supabase.rpc('is_current_user_admin');
  if (error || data !== true) return { ok: false as const, user: null };
  return { ok: true as const, user };
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const auth = await isAdmin();
  if (!auth.ok || !auth.user) return errorResponse('Unauthorized', 401);

  try {
    const parsed = await request.json().catch(() => ({})) as Partial<EnqueueRequestBody>;
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    const body = typeof parsed.body === 'string' ? parsed.body.trim() : '';
    if (!title || !body) return errorResponse('title and body are required', 400);

    const targetUserIds = Array.isArray(parsed.targetUserIds)
      ? [...new Set(parsed.targetUserIds.map(String).map(value => value.trim()).filter(Boolean))]
      : [];
    if (targetUserIds.length > MAX_EXPLICIT_TARGETS) {
      return errorResponse(`At most ${MAX_EXPLICIT_TARGETS} target users are allowed`, 400);
    }
    if (targetUserIds.some(id => !UUID_PATTERN.test(id))) {
      return errorResponse('targetUserIds must contain valid UUIDs', 400);
    }
    const { data } = normalizePushPayload(parsed.data, parsed.imageUrl);
    const suppliedNid = typeof data.nid === 'string' && data.nid.trim() ? data.nid.trim() : null;
    const mergedData = {
      ...data,
      nid: suppliedNid ?? `push_${crypto.randomUUID()}`,
    };

    let scheduledAt: string | null = null;
    if (parsed.scheduledAt) {
      const date = new Date(parsed.scheduledAt);
      if (!Number.isFinite(date.getTime())) return errorResponse('Invalid scheduledAt format', 400);
      if (date.getTime() <= Date.now()) return errorResponse('scheduledAt must be in the future', 400);
      scheduledAt = date.toISOString();
    }
    const scheduled = scheduledAt !== null;

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('push_jobs')
      .insert({
        created_by: auth.user.id,
        title,
        body,
        data: mergedData,
        audience: targetUserIds.length ? null : { all: true },
        target_user_ids: targetUserIds.length ? targetUserIds : null,
        dry_run: false,
        scheduled_at: scheduledAt,
        // 즉시 발송도 durable outbox를 거친다. 서버/FCM의 일시 장애 때
        // 요청 한 번으로 영구 실패하지 않고 scheduler가 최대 6회 시도한다.
        status: 'queued',
        attempt_count: 0,
        locked_at: null,
      })
      .select()
      .single();
    if (insertError) throw insertError;
    const job = inserted as PushJobRow;
    return NextResponse.json(
      { ok: true, job, scheduled, queued: true },
      { status: 202 },
    );
  } catch (error) {
    const message = String((error as Error)?.message ?? error).slice(0, 500);
    console.error('[push/enqueue]', message);
    // insert 이후에는 큐가 소유권을 가진다. 여기서 실패 처리하면 정상적으로
    // 저장된 outbox 작업을 scheduler가 재시도하지 못하므로 그대로 둔다.
    const status = /required|invalid|must|not allowed|동시에/.test(message.toLowerCase()) ? 400 : 500;
    return errorResponse(message, status);
  }
}
