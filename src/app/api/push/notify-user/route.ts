// src/app/api/push/notify-user/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { GoogleAuth } from 'google-auth-library';

export const runtime = 'nodejs';

// RN에서 생성한 notifee 채널과 일치
const ANDROID_CHANNEL_ID = 'push_default_v2';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

async function isAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, user: null };
  const { data, error } = await supabase.rpc('is_current_user_admin');
  if (error || data !== true) return { ok: false as const, user: null };
  return { ok: true as const, user };
}

function loadServiceAccount(): any {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (b64) return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON(_BASE64)');
  return JSON.parse(raw);
}

async function getFcmHttpClient() {
  const creds = loadServiceAccount();
  const auth = new GoogleAuth({ credentials: creds, scopes: [FCM_SCOPE] });
  const client = await auth.getClient();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Missing FIREBASE_PROJECT_ID');
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  return { client, url };
}

// FCM data는 모두 string이어야 함
function normalizeDataPayload(data: any) {
  if (!data || typeof data !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}

async function sendToTokenV1(client: any, url: string, token: string, payload: {
  title: string; body: string; data?: Record<string, any> | null;
}) {
  const data = normalizeDataPayload(payload.data ?? {});
  const message = {
    token,
    notification: { title: payload.title, body: payload.body },
    data,
    android: {
      priority: 'HIGH',
      notification: { channel_id: ANDROID_CHANNEL_ID },
      // ttl: '3600s', // (선택) 1시간 보존
    },
  };
  try {
    const res = await client.request({ url, method: 'POST', data: { message } });
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
// 핵심: 대상 사용자 → 토큰 목록 뽑기 (uuid/bigint 모두 지원)
// ──────────────────────────────────────────────────────────────
async function resolveTokensForTarget(target: {
  authUserId?: string;        // uuid
  appUserId?: number;         // bigint
  helpdeskId?: number;        // 문의글 id
  reportId?: number;          // 분석글 id
}) {
  // 1) 직접 사용자 지정
  if (target.authUserId) {
    const { data, error } = await supabaseAdmin
      .from('device_push_tokens')
      .select('token')
      .eq('enabled', true)
      .eq('user_id', target.authUserId);
    if (error) throw error;
    return (data ?? []).map(r => r.token).filter(Boolean);
  }
  if (typeof target.appUserId === 'number') {
    // tokens.user_id(uuid) ←join→ users.auth_user_id(uuid) where users.id(bigint)=appUserId
    const { data, error } = await supabaseAdmin.rpc('get_tokens_by_app_user_id', {
      p_app_user_id: target.appUserId
    });
    // ↑ 아래에 함수 스텁을 적어둠 (없으면 inline join을 써도 됨)
    if (error) throw error;
    return (data ?? []) as string[];
  }

  // 2) helpdeskId → 작성자 찾기 → 토큰
  if (typeof target.helpdeskId === 'number') {
    // 어떤 스키마든 대비: auth_user_id가 있거나, users.id가 있을 수 있음
    const { data: q, error: qErr } = await supabaseAdmin
      .from('help_desk_questions')
      .select('auth_user_id, user_id')  // user_id는 public.users.id일 수도 있음
      .eq('id', target.helpdeskId)
      .maybeSingle();
    if (qErr) throw qErr;
    if (!q) return [];
    if (q.auth_user_id) {
      const { data, error } = await supabaseAdmin
        .from('device_push_tokens')
        .select('token').eq('enabled', true).eq('user_id', q.auth_user_id);
      if (error) throw error;
      return (data ?? []).map(r => r.token).filter(Boolean);
    }
    if (q.user_id != null) {
      const { data, error } = await supabaseAdmin.rpc('get_tokens_by_app_user_id', {
        p_app_user_id: q.user_id
      });
      if (error) throw error;
      return (data ?? []) as string[];
    }
    return [];
  }

  // 3) reportId → 작성자 찾기 → 토큰
  if (typeof target.reportId === 'number') {
    const { data: r, error: rErr } = await supabaseAdmin
      .from('reports') // 실제 테이블명에 맞게 조정
      .select('auth_user_id, user_id')
      .eq('id', target.reportId)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!r) return [];
    if (r.auth_user_id) {
      const { data, error } = await supabaseAdmin
        .from('device_push_tokens')
        .select('token').eq('enabled', true).eq('user_id', r.auth_user_id);
      if (error) throw error;
      return (data ?? []).map(x => x.token).filter(Boolean);
    }
    if (r.user_id != null) {
      const { data, error } = await supabaseAdmin.rpc('get_tokens_by_app_user_id', {
        p_app_user_id: r.user_id
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
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const payload = await request.json().catch(() => ({}));
    const { title, body: message, data, target } = payload || {};
    if (!title || !String(title).trim() || !message || !String(message).trim()) {
      return new NextResponse('title and body are required', { status: 400 });
    }
    if (!target || typeof target !== 'object') {
      return new NextResponse('target required', { status: 400 });
    }

    // 대상 토큰 조회
    const tokens = await resolveTokensForTarget(target);
    // push_jobs 기록
    const { data: job, error: insErr } = await supabaseAdmin
      .from('push_jobs')
      .insert({
        created_by: auth.user!.id,
        title: String(title).trim(),
        body: String(message),
        data: data && typeof data === 'object' ? data : null,
        audience: null,
        target_user_ids: null,      // 단일 사용자지만 토큰 기준이므로 null
        dry_run: false,
        scheduled_at: null,
        status: 'processing',
      })
      .select().single();
    if (insErr) throw insErr;

    const { client, url } = await getFcmHttpClient();
    let sent = 0, failed = 0, dead: string[] = [];

    for (const t of tokens) {
      const r = await sendToTokenV1(client, url, t, { title, body: message, data: data ?? null });
      if (r.ok) sent++; else {
        failed++;
        if (r.unregistered) dead.push(t);
      }
    }
    if (dead.length) {
      await supabaseAdmin.from('device_push_tokens').update({ enabled: false }).in('token', dead);
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('push_jobs')
      .update({
        status: 'done',
        result: { dry_run: false, total: tokens.length, sent, failed, disabled_tokens: dead.length },
      })
      .eq('id', job.id)
      .select().single();
    if (updErr) throw updErr;

    return NextResponse.json({ ok: true, job: updated });
  } catch (e: any) {
    console.error('notify-user error:', e?.message || e);
    return new NextResponse(e?.message ?? 'internal error', { status: 500 });
  }
}
