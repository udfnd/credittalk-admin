// src/app/api/push/enqueue/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { GoogleAuth } from 'google-auth-library';

export const runtime = 'nodejs';
const ANDROID_CHANNEL_ID = 'push_default_v2';


// ──────────────────────────────────────────────────────────────
// 인증(관리자 확인)
// ──────────────────────────────────────────────────────────────
async function isAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, user: null };

  const { data, error } = await supabase.rpc('is_current_user_admin');
  if (error || data !== true) return { ok: false as const, user: null };
  return { ok: true as const, user };
}

// ──────────────────────────────────────────────────────────────
// FCM v1 클라이언트
// ──────────────────────────────────────────────────────────────
function loadServiceAccount(): any {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (b64) {
    try {
      const json = Buffer.from(b64, 'base64').toString('utf8');
      return JSON.parse(json);
    } catch (e:any) {
      throw new Error(`Invalid GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: ${e?.message || e}`);
    }
  }
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_JSON_BASE64');
  try { return JSON.parse(raw); } catch (e:any) {
    throw new Error(`Invalid GOOGLE_SERVICE_ACCOUNT_JSON: ${e?.message || e}`);
  }
}

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

async function getFcmHttpClient() {
  const creds = loadServiceAccount();
  const auth = new GoogleAuth({ credentials: creds, scopes: [FCM_SCOPE] });
  const client = await auth.getClient();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Missing FIREBASE_PROJECT_ID');
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  return { client, url };
}

// 데이터 페이로드는 모두 문자열이어야 함 (FCM 제약)
function normalizeDataPayload(data: any | null | undefined) {
  if (!data || typeof data !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}

// 단일 토큰 전송 (HTTP v1)
async function sendToTokenV1(
  client: any,
  url: string,
  token: string,
  payload: { title: string; body: string; data?: Record<string, any> | null }
) {
  const data = normalizeDataPayload(payload.data ?? {});
  try {
    const res = await client.request({
      url,
      method: 'POST',
      data: {
        message: {
          token,
          notification: { title: payload.title, body: payload.body },
          data,
          android: {
            priority: 'HIGH',
            // (선택) 오래 오프라인일 때 큐 보존 시간
            // ttl: '3600s',
            notification: {
              // ⬇️ 여기만 'default' → 'push_default_v2'
              channel_id: ANDROID_CHANNEL_ID,
            },
          },
          // apns(ios) 필요 시 추가 가능
        },
      },
    });
    return { ok: true as const, id: res.data?.name };
  } catch (e: any) {
    const status = e?.response?.status;
    const code = e?.response?.data?.error?.status;
    const msg = e?.response?.data?.error?.message || e?.message || String(e);
    const unreg = /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/i.test(code || msg) || status === 404;
    return { ok: false as const, status, code, msg, unregistered: unreg };
  }
}

// ──────────────────────────────────────────────────────────────
// 메인 핸들러: 즉시 발송
// ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // 1) 관리자 인증
  const auth = await isAdmin();
  if (!auth.ok || !auth.user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    // 2) 입력 파싱
    const body = await request.json().catch(() => ({}));
    const {
      title,
      body: message,
      data,
      audience,
      targetUserIds,
    } = body || {};

    if (!title || !String(title).trim() || !message || !String(message).trim()) {
      return new NextResponse('title and body are required', { status: 400 });
    }

    // 3) 대상 토큰 수집 (enabled = true)
    let q = supabaseAdmin.from('device_push_tokens')
      .select('token, platform')
      .eq('enabled', true);

    // 스키마가 BIGINT user_id라면 targetUserIds도 BIGINT 배열이어야 합니다.
    if (Array.isArray(targetUserIds) && targetUserIds.length) {
      q = q.in('user_id', targetUserIds);
    }
    // audience 조건 추가 가능 (예: 플랫폼/버전 타게팅)

    const { data: tokensRows, error: tokensErr } = await q;
    if (tokensErr) throw tokensErr;

    const tokens = Array.from(new Set((tokensRows ?? []).map((r:any) => r.token))).filter(Boolean);

    // 4) push_jobs 레코드 생성 (processing)
    const { data: jobRow, error: insErr } = await supabaseAdmin
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

    // 5) HTTP v1 전송
    const { client, url } = await getFcmHttpClient();

    let sent = 0, failed = 0;
    const dead: string[] = [];

    // 간단한 동시성 제어(한 번에 100개)
    const BATCH = 100;
    for (let i = 0; i < tokens.length; i += BATCH) {
      const chunk = tokens.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        chunk.map(t => sendToTokenV1(client, url, t, { title, body: message, data: data ?? null }))
      );
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value.ok) {
          sent += 1;
        } else {
          failed += 1;
          const unreg =
            r.status === 'fulfilled' ? r.value.unregistered :
              /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/i.test(String((r as any).reason)) ;
          if (unreg) dead.push(chunk[idx]);
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
    const { data: updated, error: updErr } = await supabaseAdmin
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

    return NextResponse.json({ ok: true, job: updated });
  } catch (err: any) {
    console.error('push/enqueue v1 error:', err?.message || err);
    return new NextResponse(err?.message ?? 'unknown error', { status: 500 });
  }
}
