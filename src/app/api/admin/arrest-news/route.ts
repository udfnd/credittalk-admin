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

    if (error) {
      throw new Error(error.message);
    }

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
    const imageFile = formData.get('imageFile') as File | null;

    if (!title) {
      return new NextResponse('Title is required', { status: 400 });
    }

    let imageUrl: string | null = null;

    if (imageFile && imageFile.size > 0) {
      const BUCKET_NAME = 'arrest-news-images';
      const fileName = `${uuidv4()}-${imageFile.name}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin
        .storage
        .from(BUCKET_NAME)
        .upload(fileName, imageFile);

      if (uploadError) {
        throw new Error(`Storage Error: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabaseAdmin
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(uploadData.path);

      imageUrl = publicUrl;
    }

    const { data, error } = await supabaseAdmin
      .from('arrest_news')
      .insert({
        title,
        content,
        author_name: author_name || '관리자',
        is_published,
        image_url: imageUrl,
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
