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

// [수정됨] 사진 정보 수정 API 전체를 image_urls 기준으로 수정합니다.
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
    };

    const BUCKET_NAME = 'post-images';

    // 새 이미지가 제공된 경우(image_urls가 존재하고 내용이 있을 때)
    if (image_urls && Array.isArray(image_urls)) {
      // 1. 기존 이미지 삭제
      const { data: currentPhoto } = await supabaseAdmin.from('incident_photos').select('image_urls').eq('id', id).single();
      if (currentPhoto?.image_urls && currentPhoto.image_urls.length > 0) {
        const oldImagePaths = currentPhoto.image_urls.map((url: string) => {
          try { return new URL(url).pathname.split(`/v1/object/public/${BUCKET_NAME}/`)[1]; }
          catch { return null; }
        }).filter(Boolean);

        if (oldImagePaths.length > 0) {
          await supabaseAdmin.storage.from(BUCKET_NAME).remove(oldImagePaths as string[]);
        }
      }
      // 2. DB에 새 URL 업데이트
      updates.image_urls = image_urls;
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

// [수정됨] 사진 삭제 API를 image_urls 기준으로 수정합니다.
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
    const BUCKET_NAME = 'incident-photos';
    const imageNames = photo.image_urls.map((url: string) => url.split('/').pop()).filter(Boolean);
    if(imageNames.length > 0){
      await supabaseAdmin.storage.from(BUCKET_NAME).remove(imageNames as string[]);
    }
  }

  return new NextResponse(null, { status: 204 });
}
