/**
 * process-scheduled-push (Supabase Edge Function)
 * - pg_cron에 의해 1분마다 호출
 * - push_jobs 테이블에서 scheduled_at이 지난 queued 작업을 처리
 * - send-fcm-v1-push와 동일한 FCM 전송 로직 사용
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create } from 'https://deno.land/x/djwt@v2.8/mod.ts';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const SERVICE_ACCOUNT = JSON.parse(
  Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') || '{}',
);
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANDROID_CHANNEL_ID = 'push_default_v2';
// 기존 앱도 가진 launcher action을 명시해 하위 버전 탭 호환성을 유지한다.
const ANDROID_CLICK_ACTION = 'android.intent.action.MAIN';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  global: { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ------------------------------- Types ------------------------------- */

interface PushJobRow {
  id: number;
  created_by: string | null;
  created_at: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  audience: Record<string, unknown> | null;
  target_user_ids: string[] | null;
  dry_run: boolean;
  scheduled_at: string | null;
  status: string;
  result: Record<string, unknown> | null;
}

type TokenRow = {
  token: string;
  user_id: string;
  platform?: string | null;
  last_seen?: string | null;
  created_at?: string | null;
};

type SendResult =
  | { ok: true }
  | { ok: false; status?: number; code?: string; msg?: string };

/* ------------------------------- Google OAuth ------------------------------- */

async function importPrivateKey(pkcs8Pem: string) {
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pem = pkcs8Pem.trim();
  const body = pem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['sign'],
  );
}

async function getAccessToken() {
  if (
    !SERVICE_ACCOUNT?.private_key ||
    !SERVICE_ACCOUNT?.client_email ||
    !SERVICE_ACCOUNT?.project_id
  ) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON missing private_key/client_email/project_id',
    );
  }
  const key = await importPrivateKey(SERVICE_ACCOUNT.private_key);
  const now = Math.floor(Date.now() / 1000);
  const jwt = await create(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: SERVICE_ACCOUNT.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    },
    key,
  );
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

/* ---------------------------------- Utils ---------------------------------- */

function normalizeDataPayload(data: unknown): Record<string, string> {
  if (!data || typeof data !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (v === null || typeof v === 'undefined') continue;
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    if (!s || s === 'null' || s === 'undefined') continue;
    out[k] = s;
  }
  return out;
}

function sanitizeImageUrl(value?: string | null) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const lowered = trimmed.toLowerCase();
  if (lowered === 'null' || lowered === 'undefined') return undefined;
  return trimmed;
}

// 유저당 "최신 토큰 1개"만 발송하던 과거 정책은 다중 기기/설치 계정(어드민 등)에서
// 마지막으로 앱을 연 설치본이 알림을 독점하는 미수신 사고를 냈다.
// → 최근 활성(60일 내 등록/갱신) 토큰 전체에 발송. 죽은 토큰은 FCM UNREGISTERED
//   응답으로 자동 비활성화되므로 시간이 지나면 실기기만 남는다.
const ACTIVE_WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // 60일

function activeTokens(rows: TokenRow[]) {
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

async function selectTokens(withUserIds: string[] | null) {
  const colsWithPlatform = 'token, user_id, platform, last_seen, created_at';
  const colsNoPlatform = 'token, user_id, last_seen, created_at';

  let q = supabaseAdmin
    .from('device_push_tokens')
    .select(colsWithPlatform)
    .eq('enabled', true);
  if (withUserIds && withUserIds.length) q = q.in('user_id', withUserIds);
  let { data, error } = await q;

  if (
    error &&
    /column .*platform.* does not exist|42703/i.test(error.message || '')
  ) {
    let q2 = supabaseAdmin
      .from('device_push_tokens')
      .select(colsNoPlatform)
      .eq('enabled', true);
    if (withUserIds && withUserIds.length) q2 = q2.in('user_id', withUserIds);
    const r2 = await q2;
    if (r2.error) throw r2.error;
    return { rows: (r2.data ?? []) as TokenRow[], platformAvailable: false };
  }
  if (error) throw error;
  return { rows: (data ?? []) as TokenRow[], platformAvailable: true };
}

function isRetryable(status?: number, code?: string) {
  if (!status && !code) return true;
  if (status && [429, 500, 502, 503, 504].includes(status)) return true;
  if (
    code &&
    /UNAVAILABLE|INTERNAL|DEADLINE_EXCEEDED|RESOURCE_EXHAUSTED/i.test(code)
  )
    return true;
  return false;
}

/* ---------------------------- FCM Message Builder --------------------------- */

function buildMessage(params: {
  token: string;
  title?: string;
  body?: string;
  data: Record<string, string>;
  imageUrl?: string;
  silent?: boolean;
}) {
  const { token, title, body, data, imageUrl, silent } = params;
  const cleanImage = sanitizeImageUrl(imageUrl);

  const nid = data.nid || `${Date.now()}`;
  const osAlert = !silent && (!!title || !!body);

  const baseData: Record<string, string> = {
    ...data,
    ...(title ? { title: data.title ?? String(title) } : {}),
    ...(body ? { body: data.body ?? String(body) } : {}),
    ...(cleanImage ? { image: cleanImage } : {}),
    nid,
    collapse_key: nid,
    expect_os_alert: osAlert ? '1' : '0',
  };

  const message: Record<string, unknown> = { token, data: baseData };

  message.android = {
    priority: 'HIGH',
    collapse_key: nid,
    ...(osAlert
      ? {
          notification: {
            channel_id: ANDROID_CHANNEL_ID,
            tag: nid,
            click_action: ANDROID_CLICK_ACTION,
            ...(cleanImage ? { image: cleanImage } : {}),
          },
        }
      : {}),
  };

  if (osAlert) {
    message.notification = {
      ...(title ? { title } : {}),
      ...(body ? { body } : {}),
      ...(cleanImage ? { image: cleanImage } : {}),
    };
    message.apns = {
      headers: {
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-collapse-id': nid,
      },
      payload: {
        aps: {
          ...(title || body
            ? {
                alert: {
                  ...(title ? { title } : {}),
                  ...(body ? { body } : {}),
                },
              }
            : {}),
          ...(cleanImage ? { 'mutable-content': 1 } : {}),
        },
      },
    };
  } else {
    message.apns = {
      headers: { 'apns-push-type': 'background', 'apns-priority': '5' },
      payload: { aps: { 'content-available': 1 } },
    };
  }

  return message;
}

async function sendToToken(params: {
  accessToken: string;
  token: string;
  title?: string;
  body?: string;
  data?: Record<string, string>;
  imageUrl?: string;
  silent?: boolean;
}): Promise<SendResult> {
  const {
    accessToken,
    token,
    title,
    body,
    data = {},
    imageUrl,
    silent,
  } = params;
  const message = buildMessage({ token, title, body, data, imageUrl, silent });

  const FCM_URL = `https://fcm.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/messages:send`;
  const res = await fetch(FCM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    try {
      const parsed = JSON.parse(bodyText);
      return {
        ok: false,
        status: res.status,
        code: parsed?.error?.status,
        msg: parsed?.error?.message ?? bodyText,
      };
    } catch {
      return { ok: false, status: res.status, code: 'UNKNOWN', msg: bodyText };
    }
  }
  return { ok: true };
}

async function sendWithRetry(
  params: {
    accessToken: string;
    token: string;
    title?: string;
    body?: string;
    data?: Record<string, string>;
    imageUrl?: string;
    silent?: boolean;
  },
  attempts = 3,
): Promise<SendResult> {
  let last: SendResult | null = null;
  for (let i = 0; i < attempts; i++) {
    const r = await sendToToken(params);
    if (r.ok) return r;
    if (!isRetryable(r.status, r.code)) return r;
    last = r;
    const backoffMs = 200 * Math.pow(2, i) + Math.floor(Math.random() * 100);
    await new Promise(res => setTimeout(res, backoffMs));
  }
  return last ?? { ok: false, code: 'UNKNOWN' };
}

/* --------------------------------- Handler --------------------------------- */

Deno.serve(async req => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // 예약 시간이 지난 queued 작업 조회
    const now = new Date().toISOString();
    const { data: jobs, error: queryErr } = await supabaseAdmin
      .from('push_jobs')
      .select('*')
      .eq('status', 'queued')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (queryErr) throw queryErr;

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: 'No scheduled jobs to process' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Access Token 획득 (한 번만)
    const accessToken = await getAccessToken();

    const results: Array<{ jobId: number; sent: number; failed: number; disabled: number }> = [];
    const DEAD = /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/i;

    for (const job of jobs as PushJobRow[]) {
      try {
        // 상태를 processing으로 업데이트
        await supabaseAdmin
          .from('push_jobs')
          .update({ status: 'processing' })
          .eq('id', job.id);

        // 토큰 조회
        const audienceAll = Boolean(job.audience?.all);
        const { rows } = await selectTokens(
          audienceAll ? null : job.target_user_ids
        );
        const tokens = activeTokens(rows);

        if (!tokens.length) {
          await supabaseAdmin
            .from('push_jobs')
            .update({
              status: 'done',
              result: { dry_run: false, total: 0, sent: 0, failed: 0, disabled_tokens: 0, message: 'No valid tokens' },
            })
            .eq('id', job.id);
          results.push({ jobId: job.id, sent: 0, failed: 0, disabled: 0 });
          continue;
        }

        const normalizedData = normalizeDataPayload(job.data ?? {});
        // 레거시 예약 job에 nid가 없어도 job 단위로 한 개를 고정해
        // 토큰별 Date.now() id 분산을 막는다.
        const dataStr: Record<string, string> = {
          ...normalizedData,
          nid: normalizedData.nid || `push_job_${job.id}`,
        };
        const imageUrl = sanitizeImageUrl(job.data?.image as string | undefined);
        const hasLink =
          (typeof dataStr.link_url === 'string' && dataStr.link_url.length > 0) ||
          (typeof dataStr.url === 'string' && dataStr.url.length > 0);

        let sent = 0;
        let failed = 0;
        const deadTokens: string[] = [];

        // 배치 처리
        const BATCH = 100;
        for (let i = 0; i < tokens.length; i += BATCH) {
          const chunk = tokens.slice(i, i + BATCH);
          const batchResults = await Promise.allSettled(
            chunk.map(({ token, platform }) => {
              const p = (platform || '').toLowerCase();
              // Android: notification+data 하이브리드(삼성 절전에서도 OS 직접 표시 + 탭은 FCM 표준 경로).
              // iOS: 링크 있을 때만 data-only. (send-fcm-v1-push / enqueue 라우트와 동일 규칙)
              const wantDataOnly = (!job.title && !job.body) || (p === 'ios' && hasLink);

              return sendWithRetry({
                accessToken,
                token,
                title: job.title,
                body: job.body,
                data: dataStr,
                imageUrl,
                silent: wantDataOnly,
              }, 3);
            })
          );

          batchResults.forEach((r, idx) => {
            if (r.status === 'fulfilled') {
              if (r.value.ok) {
                sent++;
              } else {
                failed++;
                const code = r.value.code ?? '';
                const status = r.value.status ?? 0;
                if (DEAD.test(String(code)) || status === 404) {
                  deadTokens.push(chunk[idx].token);
                }
              }
            } else {
              failed++;
            }
          });
        }

        // 비활성화된 토큰 처리
        if (deadTokens.length) {
          await supabaseAdmin
            .from('device_push_tokens')
            .update({ enabled: false })
            .in('token', deadTokens);
        }

        // 작업 완료 업데이트
        await supabaseAdmin
          .from('push_jobs')
          .update({
            status: 'done',
            result: {
              dry_run: false,
              total: tokens.length,
              sent,
              failed,
              disabled_tokens: deadTokens.length,
            },
          })
          .eq('id', job.id);

        results.push({ jobId: job.id, sent, failed, disabled: deadTokens.length });
        console.log(`Processed scheduled push job ${job.id}: sent=${sent}, failed=${failed}`);
      } catch (jobErr) {
        console.error(`Failed to process job ${job.id}:`, jobErr);
        await supabaseAdmin
          .from('push_jobs')
          .update({
            status: 'failed',
            result: { error: String(jobErr) },
          })
          .eq('id', job.id);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: results.length, results }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('process-scheduled-push error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
