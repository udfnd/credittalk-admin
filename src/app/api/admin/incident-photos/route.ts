// src/app/api/admin/incident-photos/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
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
  console.log("API Route: Received POST request.");

  if (!(await isAdmin())) {
    console.warn("API Route: Unauthorized access attempt.");
    return new NextResponse('Unauthorized', { status: 401 });
  }
  console.log("API Route: Admin check passed.");

  try {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const imageFile = formData.get('imageFile') as File;

    if (!title || !imageFile) {
      console.error("API Route: Missing title or image file.");
      return new NextResponse('Title and Image File are required', { status: 400 });
    }

    console.log("API Route: Form data received. Original filename:", imageFile.name);

    const originalName = imageFile.name;
    const extension = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
    const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, '');
    const fileName = `${uuidv4()}${safeExtension}`;
    const BUCKET_NAME = 'incident-photos';

    console.log(`API Route: Generated key: "${fileName}". Uploading to "${BUCKET_NAME}" bucket.`);
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .upload(fileName, imageFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: imageFile.type
      });

    if (uploadError) {
      console.error('API Route: Supabase Storage Upload Error:', uploadError);
      if (uploadError.message.includes('Invalid key')) {
        console.error("API Route: 'Invalid key' DETECTED! Key used:", fileName);
      }
      return new NextResponse(`Storage Error: ${uploadError.message}`, { status: 500 });
    }

    console.log("API Route: Upload successful. Path:", uploadData.path);

    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(uploadData.path);

    if (!publicUrl) {
      console.error("API Route: Could not get public URL for path:", uploadData.path);
      return new NextResponse('Could not get public URL', { status: 500 });
    }

    console.log("API Route: Public URL obtained:", publicUrl);

    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const is_published = formData.get('is_published') === 'true';

    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('incident_photos')
      .insert([{
        title,
        description: description || '',
        category: category || '',
        image_url: publicUrl,
        is_published,
        uploader_id: null,
      }])
      .select()
      .single();

    if (dbError) {
      console.error('API Route: Supabase DB Insert Error:', dbError);
      await supabaseAdmin.storage.from(BUCKET_NAME).remove([fileName]);
      console.warn("API Route: Rolled back storage upload due to DB error.");
      return new NextResponse(`Database Error: ${dbError.message}`, { status: 500 });
    }

    console.log("API Route: DB insert successful. ID:", dbData.id);
    return NextResponse.json(dbData);

  } catch (err) {
    console.error('API Route: Uncaught Error:', err);
    let errorMessage = 'An unknown internal error occurred';
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    return new NextResponse(`Internal Server Error: ${errorMessage}`, { status: 500 });
  }
}
