// src/app/api/admin/incident-photos/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log("isAdmin: No user found.");
    return false;
  }

  const { data, error } = await supabase.rpc('is_current_user_admin');
  if (error) {
    console.error("isAdmin: RPC call failed:", error);
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
      .from('incident_photos')
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


export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const imageFiles = formData.getAll('imageFile') as File[]; // getAll로 변경
    const link_url = formData.get('link_url') as string | null;

    if (!title || imageFiles.length === 0 || imageFiles[0].size === 0) {
      return new NextResponse('Title and at least one Image File are required', { status: 400 });
    }

    const imageUrls: string[] = []; // URL 배열
    const BUCKET_NAME = 'incident-photos';

    for (const imageFile of imageFiles) {
      const originalName = imageFile.name;
      const extension = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
      const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, '');
      const fileName = `${uuidv4()}${safeExtension}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(fileName, imageFile, { contentType: imageFile.type });

      if (uploadError) throw new Error(`Storage Error: ${uploadError.message}`);

      const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path);
      if (publicUrl) imageUrls.push(publicUrl);
    }

    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const is_published = formData.get('is_published') === 'true';

    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('incident_photos')
      .insert([{
        title,
        description: description || '',
        category: category || '',
        image_urls: imageUrls, // 배열 저장
        is_published,
        uploader_id: null,
        link_url,
      }])
      .select()
      .single();

    if (dbError) {
      // DB 에러 시 업로드된 이미지 롤백
      const imageNames = imageUrls.map(url => url.split('/').pop()).filter(Boolean);
      if (imageNames.length > 0) await supabaseAdmin.storage.from(BUCKET_NAME).remove(imageNames as string[]);
      throw new Error(`Database Error: ${dbError.message}`);
    }

    return NextResponse.json(dbData);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown internal error';
    return new NextResponse(`Internal Server Error: ${errorMessage}`, { status: 500 });
  }
}
