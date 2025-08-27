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

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('partner_banners')
    .select('*')
    .order('is_active', { ascending: false })
    .order('sort', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true, items: data });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  const { title, image_url, link_url, sort = 0, is_active = true } = await req.json();
  if (!image_url) return new NextResponse('image_url required', { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('partner_banners')
    .insert({ title, image_url, link_url, sort, is_active })
    .select()
    .single();

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}
