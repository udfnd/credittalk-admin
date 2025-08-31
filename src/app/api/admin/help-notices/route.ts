import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

async function isAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, user: null };
  const { data } = await supabase.rpc('is_current_user_admin');
  return { ok: data === true, user };
}

export async function GET() {
  const auth = await isAdmin();
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('help_desk_notices')
    .select('*')
    .order('pinned', { ascending: false })
    .order('pinned_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true, items: data });
}

export async function POST(req: NextRequest) {
  const auth = await isAdmin();
  if (!auth.ok || !auth.user) return new NextResponse('Unauthorized', { status: 401 });

  const payload = await req.json().catch(() => ({}));
  const { title, body, pinned = false, pinned_until = null, is_published = true } = payload || {};

  if (!title || !body) return new NextResponse('title/body required', { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('help_desk_notices')
    .insert({
      author_id: auth.user.id,
      title,
      body,
      pinned,
      pinned_at: pinned ? new Date().toISOString() : null,
      pinned_until,
      is_published,
    })
    .select()
    .single();

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}
