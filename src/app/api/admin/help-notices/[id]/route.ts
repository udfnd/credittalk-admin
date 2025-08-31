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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await isAdmin();
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  for (const k of ['title', 'body', 'is_published', 'pinned', 'pinned_until'] as const) {
    if (k in body) patch[k] = body[k];
  }
  if ('pinned' in patch) {
    patch['pinned_at'] = patch['pinned'] ? new Date().toISOString() : null;
  }

  const { data, error } = await supabaseAdmin
    .from('help_desk_notices')
    .update(patch)
    .eq('id', Number(id))
    .select()
    .single();

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await isAdmin();
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });

  const { error } = await supabaseAdmin
    .from('help_desk_notices')
    .delete()
    .eq('id', Number(id));

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
