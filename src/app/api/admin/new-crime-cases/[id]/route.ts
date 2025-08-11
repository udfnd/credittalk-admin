// src/app/api/admin/new-crime-cases/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

interface NewCrimeCaseUpdatePayload {
  title: string;
  method: string;
  is_published: boolean;
  link_url?: string | null;
  category?: string | null;
  image_urls?: string[];
}

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: isAdminResult } = await supabase.rpc('is_current_user_admin');
  return isAdminResult === true;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('new_crime_cases')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return new NextResponse(`New crime case not found: ${error.message}`, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { title, method, is_published, link_url, category, image_urls } = await request.json();

    const updates: Partial<NewCrimeCaseUpdatePayload> = {
      title,
      method,
      is_published,
      link_url,
      category,
    };

    const BUCKET_NAME = 'post-images';

    if (image_urls && Array.isArray(image_urls)) {
      const { data: currentCase } = await supabaseAdmin.from('new_crime_cases').select('image_urls').eq('id', id).single();
      if (currentCase?.image_urls && currentCase.image_urls.length > 0) {
        const oldImagePaths = currentCase.image_urls.map((url: string) => {
          try { return new URL(url).pathname.split(`/v1/object/public/${BUCKET_NAME}/`)[1]; }
          catch { return null; }
        }).filter(Boolean);

        if (oldImagePaths.length > 0) {
          await supabaseAdmin.storage.from(BUCKET_NAME).remove(oldImagePaths as string[]);
        }
      }
      updates.image_urls = image_urls;
    }

    const { error } = await supabaseAdmin
      .from('new_crime_cases')
      .update(updates)
      .eq('id', id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ message: 'Update successful' });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}


export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { data: crimeCase, error: fetchError } = await supabaseAdmin
      .from('new_crime_cases')
      .select('image_urls')
      .eq('id', id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch case for deletion: ${fetchError.message}`);
    }

    const { error: deleteError } = await supabaseAdmin
      .from('new_crime_cases')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Database delete error: ${deleteError.message}`);
    }

    if (crimeCase?.image_urls && crimeCase.image_urls.length > 0) {
      const BUCKET_NAME = 'post-images';
      const imagePaths = crimeCase.image_urls.map((url: string) => {
        try { return new URL(url).pathname.split(`/v1/object/public/${BUCKET_NAME}/`)[1]; }
        catch { return null; }
      }).filter(Boolean);

      if (imagePaths.length > 0) {
        await supabaseAdmin.storage.from(BUCKET_NAME).remove(imagePaths as string[]);
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch(err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
