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
  image_url?: string | null;
};

// 단일 사진 조회
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('incident_photos')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return new NextResponse(error.message, { status: 404 });
  return NextResponse.json(data);
}

// 사진 정보 수정
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
    };

    const imageFile = formData.get('imageFile') as File | null;
    const BUCKET_NAME = 'incident-photos';

    if (imageFile && imageFile.size > 0) {
      const { data: currentPhoto } = await supabaseAdmin.from('incident_photos').select('image_url').eq('id', id).single();
      if (currentPhoto?.image_url) {
        const oldImageName = currentPhoto.image_url.split('/').pop();
        if (oldImageName) {
          await supabaseAdmin.storage.from(BUCKET_NAME).remove([oldImageName]);
        }
      }

      const originalName = imageFile.name;
      const extension = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
      const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, '');
      const fileName = `${uuidv4()}${safeExtension}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(fileName, imageFile);

      if (uploadError) throw new Error(`Storage error: ${uploadError.message}`);

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(uploadData.path);
      updates.image_url = publicUrl;
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

// 사진 삭제
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
    .select('image_url')
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

  if (photo.image_url) {
    const BUCKET_NAME = 'incident-photos';
    const imageName = photo.image_url.split('/').pop();
    if(imageName){
      await supabaseAdmin.storage.from(BUCKET_NAME).remove([imageName]);
    }
  }

  return new NextResponse(null, { status: 204 });
}
