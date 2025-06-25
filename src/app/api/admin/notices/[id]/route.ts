// src/app/api/admin/notices/[id]/route.ts
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

type NoticeUpdate = {
  title: string;
  content: string;
  link_url: string | null;
  author_name: string | null;
  is_published: boolean;
  image_urls?: string[] | null;
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
    .from('notices')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return new NextResponse(`Notice not found: ${error.message}`, { status: 404 });
  }
  return NextResponse.json(data);
}

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

    const updates: NoticeUpdate = {
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      link_url: formData.get('link_url') as string | null,
      author_name: formData.get('author_name') as string | null,
      is_published: formData.get('is_published') === 'true',
    };

    const imageFiles = formData.getAll('imageFile') as File[];
    const BUCKET_NAME = 'notice-images';

    if (imageFiles.length > 0 && imageFiles[0].size > 0) {
      const { data: currentNotice } = await supabaseAdmin.from('notices').select('image_urls').eq('id', id).single();
      if (currentNotice?.image_urls && currentNotice.image_urls.length > 0) {
        const oldImageNames = currentNotice.image_urls.map((url: string) => url.split('/').pop()).filter(Boolean);
        if (oldImageNames.length > 0) {
          await supabaseAdmin.storage.from(BUCKET_NAME).remove(oldImageNames as string[]);
        }
      }

      const newImageUrls: string[] = [];
      for (const imageFile of imageFiles) {
        const fileName = `${uuidv4()}-${imageFile.name}`;
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .upload(fileName, imageFile);

        if (uploadError) throw new Error(`Storage error: ${uploadError.message}`);

        const { data: { publicUrl } } = supabaseAdmin.storage
          .from(BUCKET_NAME)
          .getPublicUrl(uploadData.path);

        if (publicUrl) {
          newImageUrls.push(publicUrl);
        }
      }
      updates.image_urls = newImageUrls;
    }

    const { error } = await supabaseAdmin
      .from('notices')
      .update(updates)
      .eq('id', id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ message: 'Update successful' });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
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

  try {
    const { data: notice, error: fetchError } = await supabaseAdmin
      .from('notices')
      .select('image_urls')
      .eq('id', id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch notice for deletion: ${fetchError.message}`);
    }

    const { error: deleteError } = await supabaseAdmin
      .from('notices')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Database delete error: ${deleteError.message}`);
    }

    if (notice?.image_urls && notice.image_urls.length > 0) {
      const BUCKET_NAME = 'notice-images';
      const imageNames = notice.image_urls.map((url: string) => url.split('/').pop()).filter(Boolean);
      if (imageNames.length > 0) {
        await supabaseAdmin.storage.from(BUCKET_NAME).remove(imageNames as string[]);
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch(err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
