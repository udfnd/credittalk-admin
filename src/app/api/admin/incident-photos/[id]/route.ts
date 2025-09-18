// src/app/api/admin/incident-photos/[id]/route.ts
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

type PhotoUpdate = {
  title: string;
  description: string | null;
  category: string | null;
  is_published: boolean;
  link_url?: string | null;
  image_urls?: string[];
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('incident_photos_with_author_profile') // 테이블 -> 뷰
    .select('*')
    .eq('id', id)
    .single();

  if (error) return new NextResponse(error.message, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await isAdmin())) {
    return new NextResponse(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { title, description, category, is_published, link_url, image_urls } = await request.json();

    const updates: Partial<PhotoUpdate> = {
      title,
      description,
      category,
      is_published,
      link_url,
      image_urls: image_urls || [],
    };

    const BUCKET_NAME = 'post-images';

    const { data: currentPhoto } = await supabaseAdmin.from('incident_photos').select('image_urls').eq('id', id).single();

    if (currentPhoto) {
      const oldImageUrls: string[] = currentPhoto.image_urls || [];
      const newImageUrls: string[] = updates.image_urls || [];

      const urlsToDelete = oldImageUrls.filter((url: string) => !newImageUrls.includes(url));

      if (urlsToDelete.length > 0) {
        const pathsToDelete = urlsToDelete.map((url: string) => {
          try {
            return new URL(url).pathname.split(`/v1/object/public/${BUCKET_NAME}/`)[1];
          } catch {
            return null;
          }
        }).filter(Boolean);

        if (pathsToDelete.length > 0) {
          await supabaseAdmin.storage.from(BUCKET_NAME).remove(pathsToDelete as string[]);
        }
      }
    }

    const { error } = await supabaseAdmin
      .from('incident_photos')
      .update(updates)
      .eq('id', id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ message: 'Update successful' });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(JSON.stringify({ message: errorMessage }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { data: photo, error: fetchError } = await supabaseAdmin
    .from('incident_photos')
    .select('image_urls')
    .eq('id', id)
    .single();

  if (fetchError) {
    return new NextResponse('Photo not found', { status: 404 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from('incident_photos')
    .delete()
    .eq('id', id);

  if (deleteError) return new NextResponse(deleteError.message, { status: 500 });

  if (photo.image_urls && photo.image_urls.length > 0) {
    const BUCKET_NAME = 'post-images';
    const imagePaths = photo.image_urls.map((url: string) => {
      try {
        return new URL(url).pathname.split(`/v1/object/public/${BUCKET_NAME}/`)[1];
      } catch {
        return null;
      }
    }).filter(Boolean);

    if(imagePaths.length > 0){
      await supabaseAdmin.storage.from(BUCKET_NAME).remove(imagePaths as string[]);
    }
  }

  return new NextResponse(null, { status: 204 });
}
