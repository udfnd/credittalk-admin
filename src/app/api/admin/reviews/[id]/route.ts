// src/app/api/admin/reviews/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// [수정됨] 업데이트에 사용될 데이터의 타입을 명확하게 정의합니다.
type ReviewUpdatePayload = {
  title: string;
  content: string;
  rating: number;
  is_published: boolean;
  image_urls?: string[];
};

// 관리자인지 확인하는 헬퍼 함수
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
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!await isRequestFromAdmin()) {
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

// 후기 수정 (PUT 메서드)
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
    const updates: ReviewUpdatePayload = {
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      rating: Number(formData.get('rating')),
      is_published: formData.get('is_published') === 'true',
    };

    const imageFiles = formData.getAll('imageFile') as File[];
    const BUCKET_NAME = 'reviews-images';

    if (imageFiles.length > 0 && imageFiles[0].size > 0) {
      const { data: currentReview } = await supabaseAdmin.from('reviews').select('image_urls').eq('id', id).single();
      if (currentReview?.image_urls && currentReview.image_urls.length > 0) {
        const oldImageNames = currentReview.image_urls.map((url:string) => url.split('/').pop()).filter(Boolean);
        if (oldImageNames.length > 0) {
          await supabaseAdmin.storage.from(BUCKET_NAME).remove(oldImageNames as string[]);
        }
      }

      const newImageUrls: string[] = [];
      for (const imageFile of imageFiles) {
        const fileExtension = imageFile.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExtension}`;

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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!await isRequestFromAdmin()) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { data: review, error: fetchError } = await supabaseAdmin
      .from('reviews')
      .select('image_urls')
      .eq('id', id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // 'PGRST116'는 'row not found' 오류
      throw new Error(`Failed to fetch review for deletion: ${fetchError.message}`);
    }

    const { error: deleteError } = await supabaseAdmin
      .from('reviews')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Database delete error: ${deleteError.message}`);
    }

    if (review?.image_urls && review.image_urls.length > 0) {
      const BUCKET_NAME = 'reviews-images';
      const imageNames = review.image_urls.map((url: string) => url.split('/').pop()).filter(Boolean);
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
