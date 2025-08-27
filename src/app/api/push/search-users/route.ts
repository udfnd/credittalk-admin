// src/app/api/admin/push/search-users/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

type Uuid = string;

type UserRow = {
  id: number;                 // public.users.id (BIGINT)
  auth_user_id: Uuid | null;  // public.users.auth_user_id (UUID)
  name: string | null;
  nickname: string | null;
  phone_number: string | null;
};

type TokenRow = {
  user_id: Uuid;              // device_push_tokens.user_id (UUID)
  token: string;
  last_seen: string | null;
  enabled: boolean | null;
};

type SearchResultItem = {
  user_id: Uuid;              // auth.users.id
  last_seen: string | null;
  profile: {
    app_user_id: number | null;   // public.users.id
    name: string | null;
    nickname: string | null;
    phone: string | null;
  } | null;
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

export async function GET(request: NextRequest) {
  // 관리자 확인
  const auth = await isAdmin();
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const limit = Math.min(Number(searchParams.get('limit') || '200'), 500);

    // 1) 검색어로 public.users에서 후보 auth_user_id 뽑기
    let matchedAuthIds = new Set<Uuid>();

    if (q.length >= 1) {
      const uuidRegex = /^[0-9a-f-]{32,36}$/i;
      if (uuidRegex.test(q)) {
        // UUID 그대로 검색
        matchedAuthIds.add(q as Uuid);
      } else {
        // 이름 / 닉네임 / 전화번호 일부로 검색 (ILIKE)
        const { data: users, error: usersErr } = await supabaseAdmin
          .from('users')
          .select('id, auth_user_id, name, nickname, phone_number')
          .or([
            `name.ilike.%${q}%`,
            `nickname.ilike.%${q}%`,
            `phone_number.ilike.%${q}%`,
          ].join(','))
          .not('auth_user_id', 'is', null) // auth_user_id가 있어야 토큰과 매칭 가능
          .limit(500);

        if (usersErr) throw usersErr;
        (users as UserRow[] | null ?? []).forEach(u => {
          if (u.auth_user_id) matchedAuthIds.add(u.auth_user_id);
        });
      }
    }

    // 2) 토큰 풀 가져오기 (enabled=true)
    let tokenQuery = supabaseAdmin
      .from('device_push_tokens')
      .select('user_id, token, last_seen, enabled')
      .eq('enabled', true)
      .order('last_seen', { ascending: false });

    if (matchedAuthIds.size > 0) {
      tokenQuery = tokenQuery.in('user_id', Array.from(matchedAuthIds));
    } else if (q.length === 0) {
      // 검색어 없으면 최근 본 토큰 상위만
      tokenQuery = tokenQuery.limit(limit);
    } else {
      // 검색어는 있었지만 users에서 못 찾았다면 결과 없음
      return NextResponse.json({ ok: true, items: [] as SearchResultItem[] });
    }

    const { data: tokens, error: tokensErr } = await tokenQuery;
    if (tokensErr) throw tokensErr;

    const tokenRows: TokenRow[] = (tokens ?? []) as any;

    if (!tokenRows.length) {
      return NextResponse.json({ ok: true, items: [] as SearchResultItem[] });
    }

    // 3) public.users에서 프로필 매핑 (auth_user_id IN (...))
    const authIds = Array.from(new Set(tokenRows.map(t => t.user_id)));
    const { data: userRows, error: users2Err } = await supabaseAdmin
      .from('users')
      .select('id, auth_user_id, name, nickname, phone_number')
      .in('auth_user_id', authIds)
      .limit(1000);

    if (users2Err) throw users2Err;

    const mapByAuthId = new Map<Uuid, UserRow>();
    (userRows ?? []).forEach((u: any) => {
      if (u?.auth_user_id) mapByAuthId.set(u.auth_user_id as Uuid, u as UserRow);
    });

    // 4) 응답 조립
    const items: SearchResultItem[] = tokenRows.slice(0, limit).map((t) => {
      const u = mapByAuthId.get(t.user_id) || null;
      return {
        user_id: t.user_id,
        last_seen: t.last_seen,
        profile: u ? {
          app_user_id: u.id ?? null,
          name: u.name ?? null,
          nickname: u.nickname ?? null,
          phone: u.phone_number ?? null,
        } : null,
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    console.error('search-users error:', e?.message || e);
    return new NextResponse(e?.message ?? 'internal error', { status: 500 });
  }
}
