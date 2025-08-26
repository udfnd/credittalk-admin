// src/app/api/push/notify-user/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { GoogleAuth, type AuthClient } from 'google-auth-library';

export const runtime = 'nodejs';

const ANDROID_CHANNEL_ID = 'push_default_v2';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

type Uuid = string;

interface ServiceAccountCredentials {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain?: string;
}

interface DeviceTokenRow {
  token: string;
}

interface HelpDeskAuthorRow {
  auth_user_id: Uuid | null;
  user_id: number | null; // public.users.id
}

interface ReportAuthorRow {
  auth_user_id: Uuid | null;
  user_id: number | null; // public.users.id
}

interface PushJobRow {
  id: number;
  created_by: Uuid | null;
  created_at: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  audience: Record<string, unknown> | null;
  target_user_ids: Uuid[] | number[] | null;
  dry_run: boolean;
  scheduled_at: string | null;
  status: 'queued' | 'processing' | 'done' | 'failed';
  result: Record<string, unknown> | null;
}

interface NotifyRequestBody {
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  target: {
    authUserId?: Uuid;
    appUserId?: number;
    helpdeskId?: number;
    reportId?: number;
  };
}

interface FcmErrorShape {
  response?: {
    status?: number;
    data?: {
      error?: {
        status?: string;
        message?: string;
      };
    };
  };
  message?: string;
}

async function isAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, user: null };
  const { data, error } = await supabase.rpc('is_current_user_admin');
  if (error || data !== true) return { ok: false as const, user: null };
  return { ok: true as const, user };
}

function loadServiceAccount(): ServiceAccountCredentials {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (b64) return JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as ServiceAccountCredentials;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON(_BASE64)');
  return JSON.parse(raw) as ServiceAccountCredentials;
}

async function getFcmHttpClient(): Promise<{ client: AuthClient; url: string }> {
  const creds = loadServiceAccount();
  const auth = new GoogleAuth({ credentials: creds, scopes: [FCM_SCOPE] });
  const client = await auth.getClient();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Missing FIREBASE_PROJECT_ID');
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  return { client, url };
}

function normalizeDataPayload(data?: Record<string, unknown> | null): Record<string, string> {
  if (!data || typeof data !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}

type SendResult =
  | { ok: true; id?: string }
  | { ok: false; status?: number; code?: string; msg?: string; unregistered?: boolean };

async function sendToTokenV1(
  client: AuthClient,
  url: string,
  token: string,
  payload: { title: string; body: string; data?: Record<string, unknown> | null }
): Promise<SendResult> {
  const data = normalizeDataPayload(payload.data ?? {});
  const message = {
    token,
    notification: { title: payload.title, body: payload.body },
    data,
    android: {
      priority: 'HIGH',
      notification: { channel_id: ANDROID_CHANNEL_ID },
    },
  };
  try {
    const res = await client.request<{ name?: string }>({ url, method: 'POST', data: { message } });
    return { ok: true, id: res.data?.name };
  } catch (e: unknown) {
    const err = e as FcmErrorShape;
    const status = err.response?.status;
    const code = err.response?.data?.error?.status;
    const msg = err.response?.data?.error?.message || err.message || String(e);
    const unreg = /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/i.test(code ?? '') || status === 404;
    return { ok: false, status, code, msg, unregistered: unreg };
  }
}

// ──────────────────────────────────────────────────────────────
// 핵심: 대상 사용자 → 토큰 목록 뽑기 (uuid/bigint 모두 지원)
// ──────────────────────────────────────────────────────────────
async function resolveTokensForTarget(target: {
  authUserId?: Uuid;
  appUserId?: number;
  helpdeskId?: number;
  reportId?: number;
}): Promise<string[]> {
  // 1) 직접 사용자 지정 (UUID)
  if (target.authUserId) {
    const { data, error } = await supabaseAdmin
      .from('device_push_tokens')
      .select('token')
      .eq('enabled', true)
      .eq('user_id', target.authUserId);
    if (error) throw error;
    const rows = (data ?? []) as DeviceTokenRow[];
    return rows.map((r) => r.token).filter(Boolean);
  }

  // 2) 앱 사용자 BIGINT
  if (typeof target.appUserId === 'number') {
    const { data, error } = await supabaseAdmin.rpc('get_tokens_by_app_user_id', {
      p_app_user_id: target.appUserId,
    });
    if (error) throw error;
    return (data ?? []) as string[];
  }

  // 3) helpdeskId → 작성자 찾기 → 토큰
  if (typeof target.helpdeskId === 'number') {
    const { data: q, error: qErr } = await supabaseAdmin
      .from('help_desk_questions')
      .select('auth_user_id, user_id')
      .eq('id', target.helpdeskId)
      .maybeSingle();
    if (qErr) throw qErr;
    if (!q) return [];

    const row = q as HelpDeskAuthorRow;
    if (row.auth_user_id) {
      const { data, error } = await supabaseAdmin
        .from('device_push_tokens')
        .select('token')
        .eq('enabled', true)
        .eq('user_id', row.auth_user_id);
      if (error) throw error;
      const rows = (data ?? []) as DeviceTokenRow[];
      return rows.map((r) => r.token).filter(Boolean);
    }
    if (row.user_id != null) {
      const { data, error } = await supabaseAdmin.rpc('get_tokens_by_app_user_id', {
        p_app_user_id: row.user_id,
      });
      if (error) throw error;
      return (data ?? []) as string[];
    }
    return [];
  }

  // 4) reportId → 작성자 찾기 → 토큰
  if (typeof target.reportId === 'number') {
    const { data: r, error: rErr } = await supabaseAdmin
      .from('reports') // 실제 테이블명에 맞게 조정
      .select('auth_user_id, user_id')
      .eq('id', target.reportId)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!r) return [];

    const row = r as ReportAuthorRow;
    if (row.auth_user_id) {
      const { data, error } = await supabaseAdmin
        .from('device_push_tokens')
        .select('token')
        .eq('enabled', true)
        .eq('user_id', row.auth_user_id);
      if (error) throw error;
      const rows = (data ?? []) as DeviceTokenRow[];
      return rows.map((x) => x.token).filter(Boolean);
    }
    if (row.user_id != null) {
      const { data, error } = await supabaseAdmin.rpc('get_tokens_by_app_user_id', {
        p_app_user_id: row.user_id,
      });
      if (error) throw error;
      return (data ?? []) as string[];
    }
    return [];
  }

  return [];
}

export async function POST(request: NextRequest) {
  // 0) 관리자 확인
  const auth = await isAdmin();
  if (!auth.ok || !auth.user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const payload = (await request.json().catch(() => ({}))) as Partial<NotifyRequestBody>;
    const { title, body: message, data, target } = payload;

    if (!title || !String(title).trim() || !message || !String(message).trim()) {
      return new NextResponse('title and body are required', { status: 400 });
    }
    if (!target || typeof target !== 'object') {
      return new NextResponse('target required', { status: 400 });
    }

    // 대상 토큰 조회
    const tokens = await resolveTokensForTarget(target);
    // push_jobs 기록
    const { data: jobRaw, error: insErr } = await supabaseAdmin
      .from('push_jobs')
      .insert({
        created_by: auth.user.id,
        title: String(title).trim(),
        body: String(message),
        data: data && typeof data === 'object' ? data : null,
        audience: null,
        target_user_ids: null,
        dry_run: false,
        scheduled_at: null,
        status: 'processing',
      })
      .select()
      .single();
    if (insErr) throw insErr;

    const job = jobRaw as PushJobRow;

    const { client, url } = await getFcmHttpClient();
    let sent = 0;
    let failed = 0;
    const dead: string[] = [];

    for (const t of tokens) {
      const r = await sendToTokenV1(client, url, t, { title, body: message, data: data ?? null });
      if (r.ok) {
        sent++;
      } else {
        failed++;
        if (r.unregistered) dead.push(t);
      }
    }

    if (dead.length) {
      await supabaseAdmin.from('device_push_tokens')
        .update({ enabled: false })
        .in('token', dead);
    }

    const { data: updatedRaw, error: updErr } = await supabaseAdmin
      .from('push_jobs')
      .update({
        status: 'done',
        result: {
          dry_run: false,
          total: tokens.length,
          sent,
          failed,
          disabled_tokens: dead.length,
        },
      })
      .eq('id', job.id)
      .select()
      .single();
    if (updErr) throw updErr;

    const updated = updatedRaw as PushJobRow;
    return NextResponse.json({ ok: true, job: updated });
  } catch (e: unknown) {
    const msg = (e as { message?: string }).message ?? 'internal error';
    console.error('notify-user error:', msg);
    return new NextResponse(msg, { status: 500 });
  }
}
