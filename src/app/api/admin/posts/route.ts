// src/app/api/admin/posts/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

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
    const content = formData.get('content') as string | null;
    const category = formData.get('category') as string;
    const imageFiles = formData.getAll('imageFile') as File[];
    const link_url_input = formData.get('link_url') as string | null; // [수정됨] link_url 필드 추가

    if (!title || !category) {
      return new NextResponse('Title and category are required', { status: 400 });
    }

    let link_url = link_url_input || '';
    if (link_url && !/^https?:\/\//i.test(link_url)) {
      link_url = 'https://' + link_url;
    }

    const imageUrls: string[] = [];
    const BUCKET_NAME = 'post-images';

    for (const imageFile of imageFiles) {
      if (imageFile && imageFile.size > 0) {
        const fileExtension = imageFile.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExtension}`;

        const { data: uploadData, error: uploadError } = await supabaseAdmin
          .storage
          .from(BUCKET_NAME)
          .upload(`community-posts/${fileName}`, imageFile);

        if (uploadError) throw new Error(`Storage Error: ${uploadError.message}`);

        const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path);
        if(publicUrl) imageUrls.push(publicUrl);
      }
    }

    const { data, error } = await supabaseAdmin
      .from('community_posts')
      .insert({
        title,
        content,
        category,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        user_id: adminUserId,
        link_url,
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
