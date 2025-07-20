// src/app/api/admin/posts/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid'; // 이미지 파일명 생성을 위해 uuid import

async function isRequestFromAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!await isRequestFromAdmin()) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('community_posts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return new NextResponse(error.message, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!await isRequestFromAdmin()) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const formData = await request.formData();
    const updates: { [key: string]: any } = {
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      category: formData.get('category') as string,
    };

    const imageFiles = formData.getAll('imageFile') as File[];
    const BUCKET_NAME = 'post-images';

    if (imageFiles.length > 0 && imageFiles[0].size > 0) {
      // 1. 기존 이미지 조회 및 삭제
      const { data: currentPost } = await supabaseAdmin.from('community_posts').select('image_urls').eq('id', id).single();
      if (currentPost?.image_urls && currentPost.image_urls.length > 0) {
        const oldImagePaths = currentPost.image_urls.map((url: string) => {
          try { return new URL(url).pathname.split(`/v1/object/public/${BUCKET_NAME}/`)[1]; }
          catch (e) { return null; }
        }).filter(Boolean);

        if (oldImagePaths.length > 0) {
          await supabaseAdmin.storage.from(BUCKET_NAME).remove(oldImagePaths as string[]);
        }
      }

      // 2. 새 이미지 업로드
      const newImageUrls: string[] = [];
      for (const imageFile of imageFiles) {
        const fileExtension = imageFile.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExtension}`;
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .upload(`community-posts/${fileName}`, imageFile);

        if (uploadError) throw new Error(`Storage error: ${uploadError.message}`);

        const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path);
        if (publicUrl) newImageUrls.push(publicUrl);
      }
      updates.image_urls = newImageUrls;
    }

    // 3. DB 업데이트
    const { error } = await supabaseAdmin
      .from('community_posts')
      .update(updates)
      .eq('id', id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ message: 'Update successful' });

  } catch(err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}


// [수정됨] 게시글 삭제 (DELETE) - 스토리지 이미지 삭제 로직 추가
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!await isRequestFromAdmin()) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { data: post, error: fetchError } = await supabaseAdmin
      .from('community_posts')
      .select('image_urls')
      .eq('id', id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // 'row not found'는 무시
      throw new Error(`Failed to fetch post for deletion: ${fetchError.message}`);
    }

    // 2. DB에서 게시글 데이터를 삭제합니다.
    const { error: deleteError } = await supabaseAdmin
      .from('community_posts')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Database delete error: ${deleteError.message}`);
    }

    if (post?.image_urls && post.image_urls.length > 0) {
      const BUCKET_NAME = 'post-images';
      const imagePaths = post.image_urls.map((url: string) => {
        try { return new URL(url).pathname.split(`/v1/object/public/${BUCKET_NAME}/`)[1]; }
        catch (e) { return null; }
      }).filter(Boolean);

      if (imagePaths.length > 0) {
        await supabaseAdmin.storage.from(BUCKET_NAME).remove(imagePaths as string[]);
      }
    }

    return new NextResponse(null, { status: 204 });

  } catch(err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
