// src/app/api/admin/posts/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

interface PostUpdatePayload {
  title: string;
  content: string | null;
  category: string;
  link_url: string | null;
  image_urls?: string[];
}

async function isRequestFromAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!await isRequestFromAdmin()) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('community_posts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return new NextResponse(error.message, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!await isRequestFromAdmin()) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { title, content, category, link_url, image_urls } = await request.json();

    const updates: Partial<PostUpdatePayload> = {
      title,
      content,
      category,
      link_url,
      image_urls: image_urls || [],
    };

    const BUCKET_NAME = 'post-images';

    const { data: currentPost } = await supabaseAdmin.from('community_posts').select('image_urls').eq('id', id).single();

    if (currentPost) {
      const oldImageUrls: string[] = currentPost.image_urls || [];
      const newImageUrls: string[] = updates.image_urls || [];

      const urlsToDelete = oldImageUrls.filter((url: string) => !newImageUrls.includes(url));

      if (urlsToDelete.length > 0) {
        const oldImagePaths = urlsToDelete.map((url: string) => {
          try {
            return new URL(url).pathname.split(`/v1/object/public/${BUCKET_NAME}/`)[1];
          }
          catch {
            return null;
          }
        }).filter(Boolean);

        if (oldImagePaths.length > 0) {
          await supabaseAdmin.storage.from(BUCKET_NAME).remove(oldImagePaths as string[]);
        }
      }
    }

    const { error } = await supabaseAdmin
      .from('community_posts')
      .update(updates)
      .eq('id', id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ message: 'Update successful' });
  } catch(err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!await isRequestFromAdmin()) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { data: post, error: fetchError } = await supabaseAdmin
      .from('community_posts')
      .select('image_urls')
      .eq('id', id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch post for deletion: ${fetchError.message}`);
    }

    const { error: deleteError } = await supabaseAdmin
      .from('community_posts')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Database delete error: ${deleteError.message}`);
    }

    if (post?.image_urls && post.image_urls.length > 0) {
      const BUCKET_NAME = 'post-images';
      const imagePaths = post.image_urls.map((url: string) => {
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
