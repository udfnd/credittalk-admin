// src/app/api/admin/notices/route.ts
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
    console.error("Admin check failed in notices API:", error);
    return false;
  }
  return data === true;
}

export async function GET() {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('notices')
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

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const link_url = formData.get('link_url') as string | null;
    const author_name = formData.get('author_name') as string | null;
    const is_published = formData.get('is_published') === 'true';
    const imageFiles = formData.getAll('imageFile') as File[];

    if (!title || !content) {
      return new NextResponse('Title and Content are required', { status: 400 });
    }

    const imageUrls: string[] = [];
    const BUCKET_NAME = 'notice-images';

    for (const imageFile of imageFiles) {
      if (imageFile && imageFile.size > 0) {
        const fileExtension = imageFile.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExtension}`;

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

        if(publicUrl) {
          imageUrls.push(publicUrl);
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('notices')
      .insert({
        title,
        content,
        link_url,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        author_name: author_name || 'Admin',
        is_published,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database Error: ${error.message}`);
    }

    return NextResponse.json(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown internal error';
    console.error('Notice POST Error:', errorMessage);
    return new NextResponse(errorMessage, { status: 500 });
  }
}
