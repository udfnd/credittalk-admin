// src/app/api/admin/reviews/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid'; // uuid 추가

async function isAdmin(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: isAdminResult } = await supabase.rpc('is_current_user_admin');
  return isAdminResult ? user.id : null;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const adminUserId = await isAdmin(supabase);

  if (!adminUserId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const rating = Number(formData.get('rating'));
    const is_published = formData.get('is_published') === 'true';
    const imageFiles = formData.getAll('imageFile') as File[];

    if (!title || !content) {
      return new NextResponse('Title and content are required', { status: 400 });
    }

    const imageUrls: string[] = [];
    const BUCKET_NAME = 'reviews-images'; // Supabase 스토리지 버킷 이름

    for (const imageFile of imageFiles) {
      if (imageFile && imageFile.size > 0) {
        const fileExtension = imageFile.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExtension}`;

        const { data: uploadData, error: uploadError } = await supabaseAdmin
          .storage
          .from(BUCKET_NAME)
          .upload(fileName, imageFile);

        if (uploadError) throw new Error(`Storage Error: ${uploadError.message}`);

        const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path);
        if(publicUrl) imageUrls.push(publicUrl);
      }
    }

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        title,
        content,
        rating,
        is_published,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        user_id: adminUserId,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown internal error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
