import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

async function isAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.rpc('is_current_user_admin');
  return !error && data === true;
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ ok: false, error: 'file required' }, { status: 400 });

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `public/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: upErr } = await supabaseAdmin
    .storage.from('partner-banners')
    .upload(path, Buffer.from(arrayBuffer), {
      contentType: file.type || 'image/*',
      upsert: false,
    });
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  const { data: pub } = supabaseAdmin.storage.from('partner-banners').getPublicUrl(path);
  const imageUrl = pub.publicUrl;

  return NextResponse.json({ ok: true, imageUrl });
}
