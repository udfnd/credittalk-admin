import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const BUCKET_NAME = 'helpdesk-notice-images';

async function isAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, user: null };
  const { data } = await supabase.rpc('is_current_user_admin');
  return { ok: data === true, user };
}

function extractStorageObjectName(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    return pathname.substring(pathname.lastIndexOf('/') + 1);
  } catch {
    return null;
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await isAdmin();
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  for (const k of ['title', 'body', 'is_published', 'pinned', 'pinned_until', 'link_url'] as const) {
    if (k in body) patch[k] = body[k];
  }
  if ('pinned' in patch) {
    patch['pinned_at'] = patch['pinned'] ? new Date().toISOString() : null;
  }

  if ('image_urls' in body) {
    const incoming: unknown = body.image_urls;
    const newImageUrls: string[] = Array.isArray(incoming)
      ? (incoming as unknown[]).filter((v): v is string => typeof v === 'string')
      : [];
    patch['image_urls'] = newImageUrls.length > 0 ? newImageUrls : null;

    const { data: current } = await supabaseAdmin
      .from('help_desk_notices')
      .select('image_urls')
      .eq('id', Number(id))
      .single();

    if (current) {
      const oldImageUrls: string[] = current.image_urls || [];
      const urlsToDelete = oldImageUrls.filter((url) => !newImageUrls.includes(url));

      if (urlsToDelete.length > 0) {
        const oldImageNames = urlsToDelete
          .map(extractStorageObjectName)
          .filter((name): name is string => !!name);

        if (oldImageNames.length > 0) {
          await supabaseAdmin.storage.from(BUCKET_NAME).remove(oldImageNames);
        }
      }
    }
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

  const { data: notice, error: fetchError } = await supabaseAdmin
    .from('help_desk_notices')
    .select('image_urls')
    .eq('id', Number(id))
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    return new NextResponse(`Failed to fetch notice for deletion: ${fetchError.message}`, { status: 500 });
  }

  const { error } = await supabaseAdmin
    .from('help_desk_notices')
    .delete()
    .eq('id', Number(id));

  if (error) return new NextResponse(error.message, { status: 500 });

  if (notice?.image_urls && Array.isArray(notice.image_urls) && notice.image_urls.length > 0) {
    const imageNames = (notice.image_urls as string[])
      .map(extractStorageObjectName)
      .filter((name): name is string => !!name);
    if (imageNames.length > 0) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove(imageNames);
    }
  }

  return NextResponse.json({ ok: true });
}
