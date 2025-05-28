import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc('is_current_user_admin');
  if (error) {
    console.error("Admin check failed:", error);
    return false;
  }
  return data === true;
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const imageFile = formData.get('imageFile') as File;
    const is_published = formData.get('is_published') === 'true';

    if (!title || !imageFile) {
      return new NextResponse('Title and Image File are required', { status: 400 });
    }

    const originalName = imageFile.name;
    const fileName = `<span class="math-inline">\{uuidv4\(\)\}</span>{safeExtension}`;
    console.log("Uploading file with key:", fileName);

    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('incident-photos')
      .upload(fileName, imageFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase Storage Error:', uploadError);
      return new NextResponse(`Storage Error: ${uploadError.message}`, { status: 500 });
    }

    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from('incident-photos')
      .getPublicUrl(uploadData.path);

    if (!publicUrl) {
      return new NextResponse('Could not get public URL', { status: 500 });
    }

    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('incident_photos')
      .insert([{
        title,
        description,
        category,
        image_url: publicUrl,
        is_published,
        uploader_id: null,
      }])
      .select()
      .single();

    if (dbError) {
      console.error('Supabase DB Error:', dbError);
      await supabaseAdmin.storage.from('incident-photos').remove([fileName]);
      return new NextResponse(`Database Error: ${dbError.message}`, { status: 500 });
    }

    return NextResponse.json(dbData);

  } catch (err) {
    console.error('API Error:', err);
    let errorMessage = 'An unknown error occurred';
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'string') {
      errorMessage = err;
    }
    return new NextResponse(`Internal Server Error: ${errorMessage}`, { status: 500 });
  }
}
