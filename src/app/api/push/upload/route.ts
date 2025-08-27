// src/app/api/push/upload/route.ts
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
  const { data, error } = await supabase.rpc('is_current_user_admin');
  if (error || data !== true) return { ok: false as const, user: null };
  return { ok: true as const, user };
}

// 간단 파일명 정리
function sanitizeName(name: string) {
  return name.replace(/[^\w.\-]/g, '_');
}

export async function POST(request: NextRequest) {
  const auth = await isAdmin();
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });

  const form = await request.formData();
  const file = form.get('file') as File | null;
  if (!file) return new NextResponse('file required', { status: 400 });

  const MAX_BYTES = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_BYTES) {
    return new NextResponse('file too large (max 5MB)', { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  const key = `${today}/${crypto.randomUUID()}-${sanitizeName(file.name)}`;

  const { error: upErr } = await supabaseAdmin
    .storage
    .from('push-images')
    .upload(key, arrayBuffer, {
      contentType: file.type || `image/${ext}`,
      upsert: true,
      cacheControl: '31536000',
    });

  if (upErr) {
    console.error('upload error:', upErr.message);
    return new NextResponse(upErr.message, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from('push-images').getPublicUrl(key);
  const imageUrl = data.publicUrl;

  return NextResponse.json({ ok: true, imageUrl, key });
}
