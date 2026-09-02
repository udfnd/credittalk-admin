import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { normalizePushPayload } from '@/lib/push/internal';

export const runtime = 'nodejs';

type Target = {
  authUserId?: string;
  appUserId?: number;
  helpdeskId?: number;
  reportId?: number;
};

type NotifyRequestBody = {
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  target: Target;
};

async function isAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, user: null };
  const { data, error } = await supabase.rpc('is_current_user_admin');
  if (error || data !== true) return { ok: false as const, user: null };
  return { ok: true as const, user };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authUserIdForAppUser(appUserId: number): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('auth_user_id')
    .eq('id', appUserId)
    .maybeSingle();
  if (error) throw error;
  const value = String(data?.auth_user_id ?? '');
  return UUID_PATTERN.test(value) ? value : null;
}

async function resolveAuthUserIds(target: Target): Promise<string[]> {
  if (target.authUserId) {
    if (!UUID_PATTERN.test(target.authUserId)) throw new Error('Invalid authUserId');
    return [target.authUserId];
  }
  if (Number.isFinite(target.appUserId)) {
    const id = await authUserIdForAppUser(target.appUserId as number);
    return id ? [id] : [];
  }

  if (Number.isFinite(target.helpdeskId)) {
    const { data, error } = await supabaseAdmin
      .from('help_desk_questions')
      .select('auth_user_id, user_id')
      .eq('id', target.helpdeskId as number)
      .maybeSingle();
    if (error) throw error;
    if (data?.auth_user_id && UUID_PATTERN.test(String(data.auth_user_id))) {
      return [String(data.auth_user_id)];
    }
    const appUserId = data?.user_id;
    if (Number.isFinite(appUserId)) {
      const id = await authUserIdForAppUser(Number(appUserId));
      return id ? [id] : [];
    }
    return [];
  }

  if (Number.isFinite(target.reportId)) {
    const { data, error } = await supabaseAdmin
      .from('reports')
      .select('auth_user_id, user_id')
      .eq('id', target.reportId as number)
      .maybeSingle();
    if (error) throw error;
    if (data?.auth_user_id && UUID_PATTERN.test(String(data.auth_user_id))) {
      return [String(data.auth_user_id)];
    }
    const appUserId = data?.user_id;
    if (Number.isFinite(appUserId)) {
      const id = await authUserIdForAppUser(Number(appUserId));
      return id ? [id] : [];
    }
    return [];
  }
  return [];
}

export async function POST(request: NextRequest) {
  const auth = await isAdmin();
  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json().catch(() => ({})) as Partial<NotifyRequestBody>;
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const body = typeof payload.body === 'string' ? payload.body.trim() : '';
    if (!title || !body) throw new Error('title and body are required');
    if (!payload.target || typeof payload.target !== 'object') throw new Error('target required');

    const targetUserIds = [...new Set(await resolveAuthUserIds(payload.target))];
    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: 'Target user was not found' }, { status: 404 });
    }
    const { data } = normalizePushPayload(payload.data, undefined);
    const mergedData = {
      ...data,
      nid: typeof data.nid === 'string' && data.nid.trim()
        ? data.nid.trim()
        : `push_${crypto.randomUUID()}`,
    };
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('push_jobs')
      .insert({
        created_by: auth.user.id,
        title,
        body,
        data: mergedData,
        audience: null,
        target_user_ids: targetUserIds,
        dry_run: false,
        scheduled_at: new Date().toISOString(),
        status: 'queued',
        attempt_count: 0,
        locked_at: null,
      })
      .select()
      .single();
    if (insertError) throw insertError;
    return NextResponse.json(
      { ok: true, job: inserted, queued: true },
      { status: 202 },
    );
  } catch (error) {
    const message = String((error as Error)?.message ?? error).slice(0, 500);
    console.error('[push/notify-user]', message);
    const status = /required|invalid|must|not allowed|동시에/.test(message.toLowerCase()) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
