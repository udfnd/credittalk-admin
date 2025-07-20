// src/app/api/admin/arrest-news/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc('is_current_user_admin');
  if (error) {
    console.error("Admin check failed in arrest-news API:", error);
    return false;
  }
  return data === true;
}

// 모든 검거소식 조회
export async function GET() {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('arrest_news')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}

// 새로운 검거소식 생성
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const content = formData.get('content') as string | null;
    const author_name = formData.get('author_name') as string | null;
    const is_published = formData.get('is_published') === 'true';
    const imageFiles = formData.getAll('imageFile') as File[]; // getAll로 변경
    const link_url = formData.get('link_url') as string | null;

    if (!title) {
      return new NextResponse('Title is required', { status: 400 });
    }

    const imageUrls: string[] = []; // URL을 담을 배열

    if (imageFiles.length > 0 && imageFiles[0].size > 0) {
      const BUCKET_NAME = 'arrest-news-images';
      for (const imageFile of imageFiles) {
        const fileName = `${uuidv4()}-${imageFile.name}`;
        const { data: uploadData, error: uploadError } = await supabaseAdmin
          .storage
          .from(BUCKET_NAME)
          .upload(fileName, imageFile);

        if (uploadError) throw new Error(`Storage Error: ${uploadError.message}`);

        const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path);
        if (publicUrl) imageUrls.push(publicUrl);
      }
    }

    const { data, error } = await supabaseAdmin
      .from('arrest_news')
      .insert({
        title,
        content,
        author_name: author_name || '관리자',
        is_published,
        image_urls: imageUrls.length > 0 ? imageUrls : null, // 배열 저장
        link_url,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database Error: ${error.message}`);
    }

    return NextResponse.json(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown internal error';
    console.error('Arrest News POST Error:', errorMessage);
    return new NextResponse(errorMessage, { status: 500 });
  }
}
