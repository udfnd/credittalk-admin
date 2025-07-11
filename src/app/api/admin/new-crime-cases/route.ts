// src/app/api/admin/new-crime-cases/route.ts
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

  const { data: isAdminResult, error } = await supabase.rpc('is_current_user_admin');
  if (error) {
    console.error("Admin check failed in new-crime-cases API:", error);
    return false;
  }
  return isAdminResult === true;
}

export async function GET() {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('new_crime_cases')
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
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const formData = await request.formData();
    const methodText = formData.get('method') as string;
    const is_published = formData.get('is_published') === 'true';
    const imageFiles = formData.getAll('imageFile') as File[];

    if (!methodText) {
      return new NextResponse('Method is required', { status: 400 });
    }

    const imageUrls: string[] = [];
    const BUCKET_NAME = 'new-crime-cases-images';

    for (const imageFile of imageFiles) {
      if (imageFile && imageFile.size > 0) {
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

        if(publicUrl) {
          imageUrls.push(publicUrl);
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('new_crime_cases')
      .insert({
        method: methodText,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        is_published,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database Error: ${error.message}`);
    }

    return NextResponse.json(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown internal error';
    console.error('New Crime Case POST Error:', errorMessage);
    return new NextResponse(errorMessage, { status: 500 });
  }
}
