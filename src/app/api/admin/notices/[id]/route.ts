// src/app/api/admin/notices/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// 관리자인지 확인하는 헬퍼 함수
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
  image_url?: string | null;
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

// 공지사항 수정 (POST)
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

    const imageFile = formData.get('imageFile') as File | null;
    const BUCKET_NAME = 'notice-images';

    // 새 이미지 파일이 있는 경우에만 스토리지 작업을 수행합니다.
    if (imageFile && imageFile.size > 0) {
      // 1. 기존 이미지가 있다면 삭제합니다.
      const { data: currentNotice } = await supabaseAdmin.from('notices').select('image_url').eq('id', id).single();
      if (currentNotice?.image_url) {
        const oldImageName = currentNotice.image_url.split('/').pop();
        if (oldImageName) {
          await supabaseAdmin.storage.from(BUCKET_NAME).remove([oldImageName]);
        }
      }

      // 2. 새 이미지를 업로드합니다.
      const fileName = `${uuidv4()}-${imageFile.name}`;
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(fileName, imageFile);

      if (uploadError) throw new Error(`Storage error: ${uploadError.message}`);

      // 3. 새 이미지의 public URL을 가져옵니다.
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(uploadData.path);

      updates.image_url = publicUrl;
    }

    // 데이터베이스 업데이트
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

// 공지사항 삭제 (DELETE)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 1. DB에서 이미지 URL을 먼저 조회합니다.
    const { data: notice, error: fetchError } = await supabaseAdmin
      .from('notices')
      .select('image_url')
      .eq('id', id)
      .single();

    if (fetchError) {
      // 게시글이 없는 경우도 성공으로 처리할 수 있습니다.
      if (fetchError.code === 'PGRST116') {
        return new NextResponse(null, { status: 204 });
      }
      throw new Error(`Failed to fetch notice for deletion: ${fetchError.message}`);
    }

    // 2. DB 레코드를 삭제합니다.
    const { error: deleteError } = await supabaseAdmin
      .from('notices')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Database delete error: ${deleteError.message}`);
    }

    // 3. DB 레코드가 성공적으로 삭제된 후, 스토리지에서 이미지 파일을 삭제합니다.
    if (notice.image_url) {
      const BUCKET_NAME = 'notice-images';
      const imageName = notice.image_url.split('/').pop();
      if (imageName) {
        await supabaseAdmin.storage.from(BUCKET_NAME).remove([imageName]);
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch(err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
