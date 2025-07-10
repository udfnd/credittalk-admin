// src/app/api/admin/statistics/active-users/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

// 현재 접속자 목록 조회 (GET)
export async function GET() {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('name, nickname, phone_number, last_seen_at')
      .gte('last_seen_at', thirtyMinutesAgo)
      .order('last_seen_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}

