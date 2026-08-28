import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

interface UserProfileRow {
  auth_user_id: string;
  name: string | null;
  nickname: string | null;
}

interface BlockedUserRow {
  user_id: string;
  blocked_user_id: string;
  created_at: string;
}

interface BannedPhoneRow {
  id: number;
  created_at: string;
  phone_number: string;
  banned_by: string | null;
  banned_user_id: string | null;
  reason: string | null;
}

interface BlockActor {
  authUserId: string;
  name: string;
}

interface BlockedUserListItem {
  id: string;
  blockedUserId: string | null;
  bannedPhoneId: number | null;
  name: string | null;
  nickname: string | null;
  phoneNumber: string | null;
  blockedAt: string | null;
  blockedBy: BlockActor[];
  reason: string | null;
  accountBlockActive: boolean;
  phoneBanActive: boolean;
  profileExists: boolean;
}

type MutableBlockedUserListItem = Omit<BlockedUserListItem, 'blockedBy'> & {
  actorIds: Set<string>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getAuthenticatedAdminId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: isAdmin, error: adminError } = await supabase.rpc(
    'is_current_user_admin',
  );

  if (adminError || isAdmin !== true) return null;
  return user.id;
}

function latestDate(
  current: string | null,
  candidate: string | null,
): string | null {
  if (!candidate) return current;
  if (!current) return candidate;

  return new Date(candidate).getTime() > new Date(current).getTime()
    ? candidate
    : current;
}

function actorName(profile: UserProfileRow | undefined): string {
  return profile?.name || profile?.nickname || '관리자 계정';
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  if (!(await getAuthenticatedAdminId())) {
    return errorResponse('관리자 권한이 필요합니다.', 401);
  }

  try {
    const [adminResult, bannedPhoneResult] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('auth_user_id, name, nickname')
        .eq('is_admin', true),
      supabaseAdmin
        .from('banned_phones')
        .select(
          'id, created_at, phone_number, banned_by, banned_user_id, reason',
        )
        .order('created_at', { ascending: false }),
    ]);

    if (adminResult.error) throw adminResult.error;
    if (bannedPhoneResult.error) throw bannedPhoneResult.error;

    const adminProfiles = (adminResult.data ?? []) as UserProfileRow[];
    const bannedPhones = (bannedPhoneResult.data ?? []) as BannedPhoneRow[];

    // banned_phones는 관리자 전용 차단 흐름에서만 생성됩니다. 과거에 관리자였던
    // 계정이 남긴 차단도 놓치지 않도록 banned_by도 차단 실행자 후보에 포함합니다.
    const blockActorIds = Array.from(
      new Set([
        ...adminProfiles.map((profile) => profile.auth_user_id),
        ...bannedPhones
          .map((ban) => ban.banned_by)
          .filter((id): id is string => Boolean(id)),
      ]),
    );

    let blockedUsers: BlockedUserRow[] = [];
    if (blockActorIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('blocked_users')
        .select('user_id, blocked_user_id, created_at')
        .in('user_id', blockActorIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      blockedUsers = (data ?? []) as BlockedUserRow[];
    }

    const profileIds = Array.from(
      new Set([
        ...blockActorIds,
        ...blockedUsers.map((block) => block.blocked_user_id),
        ...bannedPhones
          .map((ban) => ban.banned_user_id)
          .filter((id): id is string => Boolean(id)),
      ]),
    );

    let profiles: UserProfileRow[] = [];
    if (profileIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('auth_user_id, name, nickname')
        .in('auth_user_id', profileIds);

      if (error) throw error;
      profiles = (data ?? []) as UserProfileRow[];
    }

    const profileMap = new Map(
      profiles.map((profile) => [profile.auth_user_id, profile]),
    );
    const entries = new Map<string, MutableBlockedUserListItem>();

    const getOrCreateEntry = (
      key: string,
      blockedUserId: string | null,
      bannedPhoneId: number | null,
    ) => {
      const existing = entries.get(key);
      if (existing) return existing;

      const targetProfile = blockedUserId
        ? profileMap.get(blockedUserId)
        : undefined;
      const entry: MutableBlockedUserListItem = {
        id: key,
        blockedUserId,
        bannedPhoneId,
        name: targetProfile?.name ?? null,
        nickname: targetProfile?.nickname ?? null,
        phoneNumber: null,
        blockedAt: null,
        reason: null,
        accountBlockActive: false,
        phoneBanActive: false,
        profileExists: Boolean(targetProfile),
        actorIds: new Set<string>(),
      };

      entries.set(key, entry);
      return entry;
    };

    for (const block of blockedUsers) {
      const entry = getOrCreateEntry(
        `user:${block.blocked_user_id}`,
        block.blocked_user_id,
        null,
      );
      entry.accountBlockActive = true;
      entry.blockedAt = latestDate(entry.blockedAt, block.created_at);
      entry.actorIds.add(block.user_id);
    }

    for (const ban of bannedPhones) {
      const key = ban.banned_user_id
        ? `user:${ban.banned_user_id}`
        : `phone:${ban.id}`;
      const entry = getOrCreateEntry(key, ban.banned_user_id, ban.id);

      entry.bannedPhoneId ??= ban.id;
      entry.phoneBanActive = true;
      entry.phoneNumber = ban.phone_number;
      entry.reason ||= ban.reason;
      entry.blockedAt = latestDate(entry.blockedAt, ban.created_at);
      if (ban.banned_by) entry.actorIds.add(ban.banned_by);
    }

    const items: BlockedUserListItem[] = Array.from(entries.values())
      .map(({ actorIds, ...entry }) => ({
        ...entry,
        blockedBy: Array.from(actorIds).map((authUserId) => ({
          authUserId,
          name: actorName(profileMap.get(authUserId)),
        })),
      }))
      .sort((a, b) => {
        if (!a.blockedAt) return 1;
        if (!b.blockedAt) return -1;
        return (
          new Date(b.blockedAt).getTime() - new Date(a.blockedAt).getTime()
        );
      });

    return NextResponse.json(
      { items },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Blocked users list error:', error);
    return errorResponse('차단 목록을 불러오지 못했습니다.', 500);
  }
}

export async function DELETE(request: NextRequest) {
  const requesterId = await getAuthenticatedAdminId();
  if (!requesterId) {
    return errorResponse('관리자 권한이 필요합니다.', 401);
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return errorResponse('올바른 차단 정보가 필요합니다.', 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return errorResponse('요청 본문을 확인해 주세요.', 400);
  }

  const blockedUserId =
    typeof body.blockedUserId === 'string' ? body.blockedUserId : null;
  const bannedPhoneId =
    typeof body.bannedPhoneId === 'number' &&
    Number.isSafeInteger(body.bannedPhoneId) &&
    body.bannedPhoneId > 0
      ? body.bannedPhoneId
      : null;

  if (blockedUserId && !UUID_PATTERN.test(blockedUserId)) {
    return errorResponse('차단 사용자 ID 형식이 올바르지 않습니다.', 400);
  }
  if (!blockedUserId && !bannedPhoneId) {
    return errorResponse('해제할 차단 정보를 찾을 수 없습니다.', 400);
  }

  try {
    let removedAccountBlocks = 0;
    let removedPhoneBans = 0;

    if (blockedUserId) {
      const [adminResult, targetBanResult] = await Promise.all([
        supabaseAdmin.from('users').select('auth_user_id').eq('is_admin', true),
        supabaseAdmin
          .from('banned_phones')
          .select('id, banned_by')
          .eq('banned_user_id', blockedUserId),
      ]);

      if (adminResult.error) throw adminResult.error;
      if (targetBanResult.error) throw targetBanResult.error;

      const actorIds = Array.from(
        new Set([
          ...(adminResult.data ?? []).map((admin) => admin.auth_user_id),
          ...(targetBanResult.data ?? [])
            .map((ban) => ban.banned_by)
            .filter((id): id is string => Boolean(id)),
        ]),
      );

      // 일반 사용자의 개인 차단은 유지하고 관리자 실행자의 차단만 제거합니다.
      if (actorIds.length > 0) {
        const { data, error } = await supabaseAdmin
          .from('blocked_users')
          .delete()
          .eq('blocked_user_id', blockedUserId)
          .in('user_id', actorIds)
          .select('user_id');

        if (error) throw error;
        removedAccountBlocks = data?.length ?? 0;
      }

      // 계정 차단 기록을 먼저 제거합니다. 전화 차단 삭제가 실패하더라도
      // 재가입 금지는 유지되어 더 안전한 부분 실패 상태가 됩니다.
      const { data, error } = await supabaseAdmin
        .from('banned_phones')
        .delete()
        .eq('banned_user_id', blockedUserId)
        .select('id');

      if (error) throw error;
      removedPhoneBans = data?.length ?? 0;
    } else if (bannedPhoneId) {
      const { data, error } = await supabaseAdmin
        .from('banned_phones')
        .delete()
        .eq('id', bannedPhoneId)
        .select('id');

      if (error) throw error;
      removedPhoneBans = data?.length ?? 0;
    }

    console.info('Admin unblocked user', {
      requesterId,
      blockedUserId,
      bannedPhoneId,
      removedAccountBlocks,
      removedPhoneBans,
    });

    return NextResponse.json({
      message: '차단을 해제했습니다.',
      removed: {
        accountBlocks: removedAccountBlocks,
        phoneBans: removedPhoneBans,
      },
    });
  } catch (error) {
    console.error('Unblock user error:', error);
    return errorResponse('차단을 해제하지 못했습니다. 다시 시도해 주세요.', 500);
  }
}
