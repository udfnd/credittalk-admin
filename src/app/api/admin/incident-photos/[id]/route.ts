// src/app/api/admin/incident-photos/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

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
  image_urls?: string[] | null;
};

// [수정됨] 단일 사진 조회 시 테이블 대신 뷰를 사용합니다.
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
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const formData = await request.formData();

    const updates: PhotoUpdate = {
      title: formData.get('title') as string,
      description: formData.get('description') as string | null,
      category: formData.get('category') as string | null,
      is_published: formData.get('is_published') === 'true',
      link_url: formData.get('link_url') as string | null,
    };

    const imageFiles = formData.getAll('imageFile') as File[];
    const BUCKET_NAME = 'incident-photos';

    if (imageFiles.length > 0 && imageFiles[0].size > 0) {
      const { data: currentPhoto } = await supabaseAdmin.from('incident_photos').select('image_urls').eq('id', id).single();
      if (currentPhoto?.image_urls && currentPhoto.image_urls.length > 0) {
        const oldImageNames = currentPhoto.image_urls.map((url: string) => url.split('/').pop()).filter(Boolean);
        if (oldImageNames.length > 0) {
          await supabaseAdmin.storage.from(BUCKET_NAME).remove(oldImageNames as string[]);
        }
      }

      const newImageUrls: string[] = [];
      for (const imageFile of imageFiles) {
        const originalName = imageFile.name;
        const extension = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
        const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, '');
        const fileName = `${uuidv4()}${safeExtension}`;
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .upload(fileName, imageFile);

        if (uploadError) throw new Error(`Storage error: ${uploadError.message}`);

        const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path);
        if (publicUrl) newImageUrls.push(publicUrl);
      }
      updates.image_urls = newImageUrls;
    }

    const { error } = await supabaseAdmin
      .from('incident_photos')
      .update(updates)
      .eq('id', id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ message: 'Update successful' });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
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
