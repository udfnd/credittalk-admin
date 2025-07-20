// src/app/api/admin/reviews/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// 관리자인지 확인하는 헬퍼 함수 (request 파라미터 제거)
async function isRequestFromAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

// 단일 후기 조회
export async function GET(
  _request: NextRequest, // 사용되지 않으므로 '_' 접두사 추가
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!await isRequestFromAdmin()) { // request 인자 없이 호출
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return new NextResponse(error.message, { status: 404 });
  }

  return NextResponse.json(data);
}

// 후기 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!await isRequestFromAdmin()) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const formData = await request.formData();
    const updates: { [key: string] } = {
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      rating: Number(formData.get('rating')),
      is_published: formData.get('is_published') === 'true',
    };

    const imageFiles = formData.getAll('imageFile') as File[];
    const BUCKET_NAME = 'review-images';

    if (imageFiles.length > 0 && imageFiles[0].size > 0) {
      // 기존 이미지 삭제
      const { data: currentReview } = await supabaseAdmin.from('reviews').select('image_urls').eq('id', id).single();
      if (currentReview?.image_urls && currentReview.image_urls.length > 0) {
        const oldImageNames = currentReview.image_urls.map((url:string) => url.split('/').pop()).filter(Boolean);
        if (oldImageNames.length > 0) {
          await supabaseAdmin.storage.from(BUCKET_NAME).remove(oldImageNames as string[]);
        }
      }

      // 새 이미지 업로드
      const newImageUrls: string[] = [];
      for (const imageFile of imageFiles) {
        const fileName = `${uuidv4()}-${imageFile.name}`;
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
      .from('reviews')
      .update(updates)
      .eq('id', id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ message: 'Update successful' });
  } catch(err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}

// 후기 삭제
export async function DELETE(
  _request: NextRequest, // 사용되지 않으므로 '_' 접두사 추가
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!await isRequestFromAdmin()) { // request 인자 없이 호출
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from('reviews')
    .delete()
    .eq('id', id);

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
