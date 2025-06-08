// src/app/api/admin/arrest-news/[id]/route.ts
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

type ArrestNewsUpdate = {
  title: string;
  content: string | null;
  author_name: string | null;
  is_published: boolean;
  image_url?: string | null; // 이미지는 선택적으로 추가되므로 '?'를 붙입니다.
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('arrest_news')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) return new NextResponse(error.message, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const formData = await request.formData();

    const updates: ArrestNewsUpdate = {
      title: formData.get('title') as string,
      content: formData.get('content') as string | null,
      author_name: formData.get('author_name') as string | null,
      is_published: formData.get('is_published') === 'true',
    };

    const imageFile = formData.get('imageFile') as File | null;
    const BUCKET_NAME = 'arrest-news-images';

    if (imageFile && imageFile.size > 0) {
      // TODO: 기존 이미지 삭제 로직 추가 (선택 사항)
      const fileName = `${uuidv4()}-${imageFile.name}`;
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
      .from('arrest_news')
      .update(updates)
      .eq('id', params.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ message: 'Update successful' });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from('arrest_news')
    .delete()
    .eq('id', params.id);

  if (error) return new NextResponse(error.message, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
