// app/api/push/enqueue/route.ts

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

type Platform = 'android' | 'ios' | null;

interface DeviceTokenRow {
  token: string;
  platform: Platform;
  user_id: string;
  last_seen: string; // ISO timestamp
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
  if (b64) return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_JSON_BASE64');
  return JSON.parse(raw);
}

async function getFcmHttpClient(): Promise<{ client: AuthClient; url: string }> {
  const creds = loadServiceAccount();
  const auth = new GoogleAuth({ credentials: creds, scopes: [FCM_SCOPE] });
  const client = await auth.getClient();
  const projectId = process.env.FIREBASE_PROJECT_ID || creds.project_id;
  if (!projectId) throw new Error('Missing FIREBASE_PROJECT_ID');
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  return { client, url };
}

// FCM data는 문자열만 허용
function normalizeDataPayload(data?: Record<string, unknown> | null): Record<string, string> {
  if (!data || typeof data !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  return out;
}

type AndroidNotification = {
  channel_id?: string;
  image?: string;
};

type AndroidConfig = {
  priority?: 'NORMAL' | 'HIGH';
  notification?: AndroidNotification;
};

type ApnsAps = {
  'content-available'?: 1;
} & Record<string, unknown>;

type ApnsPayload = {
  aps?: ApnsAps;
};

type ApnsConfig = {
  payload?: ApnsPayload;
};

type NotificationPayload = {
  title?: string;
  body?: string;
  image?: string;
};

interface FcmV1Message {
  token: string;
  data?: Record<string, string>;
  notification?: NotificationPayload;
  android?: AndroidConfig;
  apns?: ApnsConfig;
}

type SendResult =
  | { ok: true; id?: string }
  | { ok: false; status?: number; code?: string; msg?: string; unregistered?: boolean };

/**
 * forceDataOnly === true 인 경우 Android 포그라운드 onMessage 안정 보장
 */
async function sendToTokenV1(
  client: AuthClient,
  url: string,
  token: string,
  payload: {
    title: string;
    body: string;
    data?: Record<string, unknown> | null;
    imageUrl?: string;
    forceDataOnly?: boolean;
  }
): Promise<SendResult> {
  const data = normalizeDataPayload(payload.data ?? {});
  const hasLink = typeof data.link_url === 'string' && data.link_url.length > 0;
  const forceDataOnly = payload.forceDataOnly === true;

  if (!data.title) data.title = String(payload.title ?? '');
  if (!data.body)  data.body  = String(payload.body ?? '');
  if (payload.imageUrl) data.image = payload.imageUrl;

  const message: FcmV1Message = {
    token,
    data,
    android: { priority: 'HIGH' },
  };

  if (hasLink || forceDataOnly) {
    // ✅ data-only (Android 포그라운드 안정)
    // iOS의 알림 배지는 필요 시 apns.aps에 설정
    message.apns = {
      payload: {
        aps: {
          alert: { title: payload.title, body: payload.body },
          ...(payload.imageUrl ? { 'mutable-content': 1 } : {}),
        } as ApnsAps,
      },
    };
  } else {
    // (iOS에서 OS 자동표시를 활용하려면 유지 가능)
    message.notification = {
      title: payload.title,
      body:  payload.body,
      ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
    };
    message.android = {
      ...(message.android ?? {}),
      notification: {
        channel_id: ANDROID_CHANNEL_ID,
        ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
      },
    };
  }

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

/** 유저 기준 최신 1개 토큰 유지 + 플랫폼 보존 */
function pickLatestTokenPerUser(rows: DeviceTokenRow[]): Array<{ token: string; platform: Platform }> {
  const byUser = new Map<string, DeviceTokenRow>();
  for (const r of rows) {
    const prev = byUser.get(r.user_id);
    if (!prev || new Date(r.last_seen).getTime() > new Date(prev.last_seen).getTime()) {
      byUser.set(r.user_id, r);
    }
  }
  const uniq = new Map<string, { token: string; platform: Platform }>();
  for (const v of byUser.values()) {
    uniq.set(v.token, { token: v.token, platform: v.platform ?? null });
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

    // 대상 토큰 (enabled=true)
    let q = supabaseAdmin
      .from('device_push_tokens')
      .select('token, platform, user_id, last_seen')
      .eq('enabled', true);

    if (Array.isArray(targetUserIds) && targetUserIds.length) q = q.in('user_id', targetUserIds);

    const { data: tokensRows, error: tokensErr } = await q;
    if (tokensErr) throw tokensErr;

    const rows = (tokensRows ?? []) as DeviceTokenRow[];
    const tokens = pickLatestTokenPerUser(rows);

    // push_jobs 기록
    const mergedData =
      data && typeof data === 'object'
        ? { ...data, ...(imageUrl ? { image: imageUrl } : {}) }
        : imageUrl ? { image: imageUrl } : null;

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

    // FCM v1 발송 (Android → data-only 강제)
    const { client, url } = await getFcmHttpClient();
    let sent = 0, failed = 0;
    const dead: string[] = [];

    const BATCH = 100;
    for (let i = 0; i < tokens.length; i += BATCH) {
      const chunk = tokens.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        chunk.map(({ token, platform }) =>
          sendToTokenV1(client, url, token, {
            title,
            body: message,
            data: data ?? null,
            imageUrl,
            forceDataOnly: platform === 'android', // 🔑 핵심
          })
        )
      );
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          if (r.value.ok) sent += 1;
          else { failed += 1; if (r.value.unregistered) dead.push(chunk[idx].token); }
        } else failed += 1;
      });
    }

    if (dead.length) await supabaseAdmin.from('device_push_tokens').update({ enabled: false }).in('token', dead);

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
    console.error('push/enqueue v1 error:', msg);
    return new NextResponse(msg, { status: 500 });
  }
}
