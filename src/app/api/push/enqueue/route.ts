// src/app/api/push/enqueue/route.ts
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
  platform?: string | null;
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

interface EnqueueRequestBody {
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  audience?: Record<string, unknown> | null;
  targetUserIds?: Array<Uuid | number>;
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
  if (b64) {
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json) as ServiceAccountCredentials;
  }
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_JSON_BASE64');
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

// FCM data는 모두 문자열이어야 함
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
  try {
    const res = await client.request<{ name?: string }>({
      url,
      method: 'POST',
      data: {
        message: {
          token,
          notification: { title: payload.title, body: payload.body },
          data,
          android: {
            priority: 'HIGH',
            notification: { channel_id: ANDROID_CHANNEL_ID },
          },
        },
      },
    });
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

export async function POST(request: NextRequest) {
  // 1) 관리자 인증
  const auth = await isAdmin();
  if (!auth.ok || !auth.user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    // 2) 입력 파싱
    const parsed = (await request.json().catch(() => ({}))) as Partial<EnqueueRequestBody>;
    const {
      title,
      body: message,
      data,
      audience,
      targetUserIds,
    } = parsed;

    if (!title || !String(title).trim() || !message || !String(message).trim()) {
      return new NextResponse('title and body are required', { status: 400 });
    }

    // 3) 대상 토큰 수집 (enabled = true)
    let q = supabaseAdmin
      .from('device_push_tokens')
      .select('token, platform')
      .eq('enabled', true);

    if (Array.isArray(targetUserIds) && targetUserIds.length) {
      q = q.in('user_id', targetUserIds);
    }

    const { data: tokensRows, error: tokensErr } = await q;
    if (tokensErr) throw tokensErr;

    const rows = (tokensRows ?? []) as DeviceTokenRow[];
    const tokens = Array.from(new Set(rows.map((r) => r.token))).filter(Boolean);

    // 4) push_jobs 레코드 생성 (processing)
    const { data: jobRowRaw, error: insErr } = await supabaseAdmin
      .from('push_jobs')
      .insert({
        created_by: auth.user.id,
        title: String(title).trim(),
        body: String(message),
        data: data && typeof data === 'object' ? data : null,
        audience: (Array.isArray(targetUserIds) && targetUserIds.length) ? null : (audience ?? { all: true }),
        target_user_ids: (Array.isArray(targetUserIds) && targetUserIds.length) ? targetUserIds : null,
        dry_run: false,
        scheduled_at: null,
        status: 'processing',
      })
      .select()
      .single();
    if (insErr) throw insErr;

    const jobRow = jobRowRaw as PushJobRow;

    // 5) HTTP v1 전송
    const { client, url } = await getFcmHttpClient();

    let sent = 0;
    let failed = 0;
    const dead: string[] = [];

    const BATCH = 100;
    for (let i = 0; i < tokens.length; i += BATCH) {
      const chunk = tokens.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        chunk.map((t) => sendToTokenV1(client, url, t, { title, body: message, data: data ?? null }))
      );

      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          if (r.value.ok) {
            sent += 1;
          } else {
            failed += 1;
            if (r.value.unregistered) dead.push(chunk[idx]);
          }
        } else {
          failed += 1;
        }
      });
    }

    // 6) 무효 토큰 비활성화
    if (dead.length) {
      await supabaseAdmin.from('device_push_tokens')
        .update({ enabled: false })
        .in('token', dead);
    }

    // 7) 결과 저장 (done)
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
      .eq('id', jobRow.id)
      .select()
      .single();
    if (updErr) throw updErr;

    const updated = updatedRaw as PushJobRow;
    return NextResponse.json({ ok: true, job: updated });
  } catch (err: unknown) {
    const msg = (err as { message?: string }).message ?? 'unknown error';
    console.error('push/enqueue v1 error:', msg);
    return new NextResponse(msg, { status: 500 });
  }
}
