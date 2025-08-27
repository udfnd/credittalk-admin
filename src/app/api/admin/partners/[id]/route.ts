import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

async function isAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.rpc('is_current_user_admin');
  return !error && data === true;
}

function getId(req: NextRequest) {
  const url = new URL(req.url);
  const idStr = url.pathname.split('/').pop()!;
  return Number(idStr);
}

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) return new NextResponse('Unauthorized', { status: 401 });
  const id = getId(req);
  const patch = await req.json();

  const { data, error } = await supabaseAdmin
    .from('partner_banners')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return new NextResponse('Unauthorized', { status: 401 });
  const id = getId(req);

  const { error } = await supabaseAdmin
    .from('partner_banners')
    .delete()
    .eq('id', id);

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
