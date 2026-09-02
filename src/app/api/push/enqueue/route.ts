// src/app/api/push/enqueue/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { GoogleAuth, type AuthClient } from 'google-auth-library';

export const runtime = 'nodejs';

const ANDROID_CHANNEL_ID = 'push_default_v2';
// 기존 앱도 가진 launcher action을 명시해 하위 버전 탭 호환성을 유지한다.
const ANDROID_CLICK_ACTION = 'android.intent.action.MAIN';
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
  last_seen?: string | null;
  created_at?: string | null;
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
  target_user_ids: Array<Uuid | number> | null;
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
  scheduledAt?: string; // ISO 8601 datetime string
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
type AndroidConfig = {
  priority?: 'NORMAL' | 'HIGH';
  collapse_key?: string;
  notification?: {
    channel_id?: string;
    image?: string;
    tag?: string;
    click_action?: string;
  };
};
type ApnsConfig = { headers?: Record<string, string>; payload?: { aps?: Record<string, unknown> } };

interface FcmV1Message {
  token: string;
  data?: Record<string, string>;
  notification?: NotificationPayload;
  android?: AndroidConfig;
  apns?: ApnsConfig;
}

// 플랫폼/링크 기반 data-only 결정
// Android: notification+data 하이브리드로 발송 → OS가 백그라운드/종료 상태에서 직접 표시(삼성 절전/딥슬립
//   에서도 안정 전달) + 탭은 FCM 표준 경로(onNotificationOpenedApp/getInitialNotification)로 처리.
//   (과거 'Android 항상 data-only'는 삼성 S24/S25에서 탭 시 notifee+AsyncStorage 헤드리스 경로 유실로
//    "탭해도 페이지로 안 넘어감" 버그를 유발 → send-fcm-v1-push와 동일하게 하이브리드로 통일)
// iOS: 링크가 있으면 data-only(앱이 딥링크 처리), 없으면 notification(OS 표시).
function decideWantDataOnly(platform: string | null | undefined, hasLink: boolean) {
  const p = (platform || '').toLowerCase();
  if (p === 'ios') return hasLink;    // iOS: 링크 있을 때만 data-only
  return false;                       // Android/미상: 하이브리드(notification+data)
}

function buildMessage(params: {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
  imageUrl?: string;
  wantDataOnly: boolean;
}): FcmV1Message {
  const { token, title, body, data, imageUrl, wantDataOnly } = params;

  // data에 최소 필드는 항상 포함(포그라운드 처리 안정화)
  const dataPayload: Record<string, string> = {
    ...data,
    title: data.title ?? String(title ?? ''),
    body:  data.body  ?? String(body  ?? ''),
    nid:   data.nid   ?? String(Date.now()),
  };

  const message: FcmV1Message = { token, data: dataPayload };

  if (!wantDataOnly) {
    // imageUrl이 있을 때만 notification.image 세팅
    message.notification = { title, body, ...(imageUrl ? { image: imageUrl } : {}) };
    message.android = {
      priority: 'HIGH',
      collapse_key: dataPayload.nid,
      notification: {
        channel_id: ANDROID_CHANNEL_ID,
        tag: dataPayload.nid,
        click_action: ANDROID_CLICK_ACTION,
        ...(imageUrl ? { image: imageUrl } : {}),
      },
    };
    message.apns = {
      headers: { 'apns-push-type': 'alert', 'apns-priority': '10' },
      payload: {
        aps: {
          alert: { title, body },
          ...(imageUrl ? { 'mutable-content': 1 } : {}),
        },
      },
    };
  } else {
    // data-only
    message.android = { priority: 'HIGH' };
    message.apns = {
      headers: { 'apns-push-type': 'background', 'apns-priority': '5' },
      payload: { aps: { 'content-available': 1 } },
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
  platform: string | null | undefined,
  payload: { title: string; body: string; data?: Record<string, unknown> | null; imageUrl?: string },
): Promise<SendResult> {
  const data = normalizeDataPayload(payload.data ?? {});
  const hasLink = Boolean(
    (typeof data.link_url === 'string' && data.link_url.length > 0) ||
    (typeof data.url === 'string' && data.url.length > 0)
  );
  const wantDataOnly = decideWantDataOnly(platform, hasLink);
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
  platform: string | null | undefined,
  payload: { title: string; body: string; data?: Record<string, unknown> | null; imageUrl?: string },
  attempts = 3,
): Promise<SendResult> {
  let last: SendResult | null = null;
  for (let i = 0; i < attempts; i++) {
    const r = await sendToTokenV1(client, url, token, platform, payload);
    if (r.ok || !r.retryable) return r;
    last = r;
    const backoffMs = 200 * Math.pow(2, i) + Math.floor(Math.random() * 100);
    await new Promise(res => setTimeout(res, backoffMs));
  }
  return last ?? { ok: false, msg: 'unknown error' };
}

/**
 * 활성(60일 내 등록/갱신) 토큰 전체 (platform 포함).
 * 과거 "최신 토큰 1개/유저" 정책은 다중 기기/설치 계정(어드민 등)에서 마지막으로
 * 앱을 연 설치본이 알림을 독점하는 미수신 사고를 냈다. 죽은 토큰은 FCM
 * UNREGISTERED 응답으로 자동 비활성화된다.
 */
const ACTIVE_WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // 60일

function pickActiveTokens(rows: DeviceTokenRow[]): Array<{ token: string; platform?: string | null }> {
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  const uniq = new Map<string, { token: string; platform?: string | null }>();
  for (const r of rows) {
    const t = new Date(r.last_seen ?? r.created_at ?? 0).getTime();
    if (!Number.isFinite(t) || t < cutoff) continue;
    if (typeof r.token === 'string' && r.token.trim().length > 0) {
      uniq.set(r.token, { token: r.token, platform: r.platform ?? null });
    }
  }
  return Array.from(uniq.values());
}

export async function POST(request: NextRequest) {
  const auth = await isAdmin();
  if (!auth.ok || !auth.user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const parsed = (await request.json().catch(() => ({}))) as Partial<EnqueueRequestBody>;
    const { title, body: message, data, audience, targetUserIds, imageUrl, scheduledAt } = parsed;
    if (!title || !String(title).trim() || !message || !String(message).trim()) {
      return new NextResponse('title and body are required', { status: 400 });
    }

    // 예약 발송 시간 검증
    let validScheduledAt: string | null = null;
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        return new NextResponse('Invalid scheduledAt format', { status: 400 });
      }
      if (scheduledDate.getTime() <= Date.now()) {
        return new NextResponse('scheduledAt must be in the future', { status: 400 });
      }
      validScheduledAt = scheduledDate.toISOString();
    }

    const isScheduledPush = !!validScheduledAt;

    // push_jobs 기록(data.image 강제 X)
    // nid는 토큰별 buildMessage(Date.now())가 아니라 job 생성 시 한 번만
    // 만든다. 그래야 모든 수신 기기의 data/collapse/tag가 같고,
    // OneUI 탭 장애를 해당 push_jobs 행으로 정확히 연결할 수 있다.
    const suppliedNid =
      data && typeof data.nid === 'string' && data.nid.trim()
        ? data.nid.trim()
        : null;
    const mergedData: Record<string, unknown> = {
      ...(data && typeof data === 'object' ? data : {}),
      nid: suppliedNid ?? `push_${crypto.randomUUID()}`,
      ...(imageUrl ? { image: imageUrl } : {}),
    };

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
        scheduled_at: validScheduledAt,
        status: isScheduledPush ? 'queued' : 'processing',
      })
      .select()
      .single();
    if (insErr) throw insErr;
    const jobRow = jobRowRaw as PushJobRow;

    // 예약 발송인 경우 즉시 발송하지 않고 저장만 함
    if (isScheduledPush) {
      return NextResponse.json({ ok: true, job: jobRow, scheduled: true });
    }

    // 토큰 조회(플랫폼 포함)
    let q = supabaseAdmin
      .from('device_push_tokens')
      .select('token, platform, user_id, last_seen, created_at')
      .eq('enabled', true);
    if (Array.isArray(targetUserIds) && targetUserIds.length) q = q.in('user_id', targetUserIds);

    const { data: tokensRows, error: tokensErr } = await q;
    if (tokensErr) throw tokensErr;

    const rows = (tokensRows ?? []) as DeviceTokenRow[];
    const tokens = pickActiveTokens(rows); // [{ token, platform }]

    // 발송
    const { client, url } = await getFcmHttpClient();
    let sent = 0, failed = 0;
    const dead: string[] = [];

    const BATCH = 100;
    for (let i = 0; i < tokens.length; i += BATCH) {
      const chunk = tokens.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        chunk.map(({ token, platform }) =>
          sendWithRetry(client, url, token, platform, {
            title,
            body: message,
            data: mergedData,
            imageUrl,
          }, 3),
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
