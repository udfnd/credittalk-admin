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
  user_id: string;
  last_seen?: string | null;   // ISO
  created_at?: string | null;  // ISO
}

type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

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
  status: JobStatus;
  result: Record<string, unknown> | null;
}

interface EnqueueRequestBody {
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  audience?: Record<string, unknown> | null;
  targetUserIds?: Array<Uuid | number>;
  imageUrl?: string;
}

interface FcmErrorShape {
  response?: {
    status?: number;
    data?: { error?: { status?: string; message?: string } };
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
  const raw = b64 ? Buffer.from(b64, 'base64').toString('utf8') : process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON(_BASE64)');
  return JSON.parse(raw);
}

async function getFcmHttpClient(): Promise<{ client: AuthClient; url: string }> {
  const creds = loadServiceAccount();
  const auth = new GoogleAuth({ credentials: creds, scopes: [FCM_SCOPE] });
  const client = await auth.getClient();

  const envProjectId = process.env.FIREBASE_PROJECT_ID;
  if (!envProjectId) throw new Error('Missing FIREBASE_PROJECT_ID');

  // sanity check: project id must match
  if (creds.project_id && envProjectId && creds.project_id !== envProjectId) {
    throw new Error(`FIREBASE_PROJECT_ID(${envProjectId}) != service_account.project_id(${creds.project_id})`);
  }

  const url = `https://fcm.googleapis.com/v1/projects/${envProjectId}/messages:send`;
  return { client, url };
}

// FCM data는 문자열만 허용
function normalizeDataPayload(data?: Record<string, unknown> | null): Record<string, string> {
  if (!data || typeof data !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  return out;
}

type SendResult =
  | { ok: true; id?: string }
  | { ok: false; status?: number; code?: string; msg?: string; unregistered?: boolean; retryable?: boolean };

type NotificationPayload = { title?: string; body?: string; image?: string };
type AndroidConfig = { priority?: 'NORMAL' | 'HIGH'; notification?: { channel_id?: string; image?: string } };
type ApnsConfig = { headers?: Record<string, string>; payload?: { aps?: Record<string, unknown> } };

interface FcmV1Message {
  token: string;
  data?: Record<string, string>;
  notification?: NotificationPayload;
  android?: AndroidConfig;
  apns?: ApnsConfig;
}

// Android: 항상 data-only
// iOS: link 있을 때만 data-only (앱 하나만 열리게)
// 기타/미상: link 있을 때만 data-only
function decideWantDataOnly(platform: string | null | undefined, hasLink: boolean): boolean {
  const p = (platform || '').toLowerCase();
  if (p === 'android') return true;
  if (p === 'ios') return hasLink;
  return hasLink;
}

function buildMessage(params: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  wantDataOnly: boolean;
}): FcmV1Message {
  const { token, title, body, data = {}, imageUrl, wantDataOnly } = params;

  // 항상 data에 기본 필드 포함 (클릭 핸들링/로깅/포그라운드 표시용)
  const dataPayload: Record<string, string> = {
    ...data,
    title: data.title ?? String(title ?? ''),
    body:  data.body  ?? String(body  ?? ''),
    ...(imageUrl ? { image: imageUrl } : {}),
    nid: data.nid ?? String(Date.now()), // 클라 디듀프용
  };

  const message: FcmV1Message = {
    token,
    data: dataPayload,
  };

  if (!wantDataOnly) {
    // 화면에 보이는 notification + 이미지
    message.notification = {
      title,
      body,
      ...(imageUrl ? { image: imageUrl } : {}),
    };
    message.android = {
      priority: 'HIGH',
      notification: {
        channel_id: ANDROID_CHANNEL_ID,
        ...(imageUrl ? { image: imageUrl } : {}),
      },
    };
    message.apns = {
      headers: {
        'apns-push-type': 'alert',
        'apns-priority': '10',
      },
      payload: {
        aps: {
          alert: { title, body },
          ...(imageUrl ? { 'mutable-content': 1 } : {}),
        },
      },
    };
  } else {
    // 진짜 무음 data-only (Android에는 OS 헤더 무시)
    message.android = { priority: 'HIGH' };
    message.apns = {
      headers: {
        'apns-push-type': 'background',
        'apns-priority': '5',
      },
      payload: {
        aps: { 'content-available': 1 },
      },
    };
  }

  return message;
}

function asRetryable(status?: number, code?: string): boolean {
  if (!status && !code) return true;
  if (status && [500, 502, 503, 504, 429].includes(status)) return true;
  if (code && /UNAVAILABLE|INTERNAL|DEADLINE_EXCEEDED|RESOURCE_EXHAUSTED/i.test(code)) return true;
  return false;
}

async function sendToTokenV1(
  client: AuthClient,
  url: string,
  token: string,
  payload: {
    title: string;
    body: string;
    data?: Record<string, unknown> | null;
    imageUrl?: string;
    platform?: string | null;
  },
): Promise<SendResult> {
  const data = normalizeDataPayload(payload.data ?? {});
  const hasLink = typeof data.link_url === 'string' && data.link_url.length > 0;
  const wantDataOnly = decideWantDataOnly(payload.platform ?? null, hasLink);
  const message = buildMessage({
    token,
    title: payload.title,
    body: payload.body,
    data,
    imageUrl: payload.imageUrl,
    wantDataOnly,
  });

  try {
    const res = await client.request<{ name?: string }>({ url, method: 'POST', data: { message } });
    return { ok: true, id: res.data?.name };
  } catch (e: unknown) {
    const err = e as FcmErrorShape;
    const status = err.response?.status;
    const code = err.response?.data?.error?.status;
    const msg = err.response?.data?.error?.message || err.message || String(e);
    const unreg = /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/i.test(code ?? '') || status === 404;
    return { ok: false, status, code, msg, unregistered: unreg, retryable: asRetryable(status, code) };
  }
}

async function sendWithRetry(
  client: AuthClient,
  url: string,
  token: string,
  payload: {
    title: string;
    body: string;
    data?: Record<string, unknown> | null;
    imageUrl?: string;
    platform?: string | null;
  },
  attempts = 3,
): Promise<SendResult> {
  let last: SendResult | null = null;
  for (let i = 0; i < attempts; i++) {
    const r = await sendToTokenV1(client, url, token, payload);
    if (r.ok || !r.retryable) return r;
    last = r;
    const backoffMs = 200 * Math.pow(2, i) + Math.floor(Math.random() * 100);
    await new Promise(res => setTimeout(res, backoffMs));
  }
  return last ?? { ok: false, msg: 'unknown error' };
}

/** 유저 기준 최신(last_seen || created_at) 1개 토큰만 유지 — platform 보존 */
function pickLatestTokenPerUser(
  rows: DeviceTokenRow[],
): Array<{ token: string; platform?: string | null }> {
  const byUser = new Map<string, DeviceTokenRow>();
  for (const r of rows) {
    const t = new Date(r.last_seen ?? r.created_at ?? 0).getTime();
    const prev = byUser.get(r.user_id);
    if (!prev || t > new Date(prev.last_seen ?? prev.created_at ?? 0).getTime()) {
      byUser.set(r.user_id, r);
    }
  }
  const uniq = new Map<string, { token: string; platform?: string | null }>();
  for (const v of byUser.values()) {
    if (v.token) uniq.set(v.token, { token: v.token, platform: v.platform ?? null });
  }
  return Array.from(uniq.values());
}

export async function POST(request: NextRequest) {
  const auth = await isAdmin();
  if (!auth.ok || !auth.user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const parsed = (await request.json().catch(() => ({}))) as Partial<EnqueueRequestBody>;
    const { title, body: message, data, audience, targetUserIds, imageUrl } = parsed;
    if (!title || !String(title).trim() || !message || !String(message).trim()) {
      return new NextResponse('title and body are required', { status: 400 });
    }

    // 대상 토큰 수집 (enabled만)
    let q = supabaseAdmin
      .from('device_push_tokens')
      .select('token, platform, user_id, last_seen, created_at')
      .eq('enabled', true);
    if (Array.isArray(targetUserIds) && targetUserIds.length) q = q.in('user_id', targetUserIds);

    const { data: tokensRows, error: tokensErr } = await q;
    if (tokensErr) throw tokensErr;

    const rows = (tokensRows ?? []) as DeviceTokenRow[];
    const tokens = pickLatestTokenPerUser(rows); // [{token, platform}]

    // push_jobs 생성 (image도 data에 남겨 추적)
    const mergedData =
      data && typeof data === 'object'
        ? { ...data, ...(imageUrl ? { image: imageUrl } : {}) }
        : imageUrl
          ? { image: imageUrl }
          : null;

    const { data: jobRowRaw, error: insErr } = await supabaseAdmin
      .from('push_jobs')
      .insert({
        created_by: auth.user.id,
        title: String(title).trim(),
        body: String(message),
        data: mergedData,
        audience: Array.isArray(targetUserIds) && targetUserIds.length ? null : (audience ?? { all: true }),
        target_user_ids: Array.isArray(targetUserIds) && targetUserIds.length ? targetUserIds : null,
        dry_run: false,
        scheduled_at: null,
        status: 'processing',
      })
      .select()
      .single();
    if (insErr) throw insErr;
    const jobRow = jobRowRaw as PushJobRow;

    // 발송
    const { client, url } = await getFcmHttpClient();
    let sent = 0, failed = 0;
    const dead: string[] = [];

    const BATCH = 100;
    for (let i = 0; i < tokens.length; i += BATCH) {
      const chunk = tokens.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        chunk.map(({ token, platform }) =>
          sendWithRetry(client, url, token, {
            title,
            body: message,
            data: data ?? null,
            imageUrl,
            platform,
          }),
        ),
      );
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          const v = r.value;
          if (v.ok) sent += 1;
          else {
            failed += 1;
            if (v.unregistered) dead.push(chunk[idx].token);
          }
        } else failed += 1;
      });
    }

    if (dead.length) {
      await supabaseAdmin.from('device_push_tokens').update({ enabled: false }).in('token', dead);
    }

    const { data: updatedRaw, error: updErr } = await supabaseAdmin
      .from('push_jobs')
      .update({
        status: 'done',
        result: { dry_run: false, total: tokens.length, sent, failed, disabled_tokens: dead.length },
      })
      .eq('id', jobRow.id)
      .select()
      .single();
    if (updErr) throw updErr;

    return NextResponse.json({ ok: true, job: updatedRaw as PushJobRow });
  } catch (err: unknown) {
    const msg = (err as { message?: string }).message ?? 'unknown error';
    console.error('push/enqueue v1 error:', err);
    return new NextResponse(msg, { status: 500 });
  }
}
