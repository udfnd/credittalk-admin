// src/app/api/admin/reviews/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

interface ReviewUpdatePayload {
  title: string;
  content: string;
  rating: number;
  is_published: boolean;
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
    .from('reviews')
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
    const { title, content, rating, is_published, image_urls } = await request.json();

    const updates: Partial<ReviewUpdatePayload> = {
      title,
      content,
      rating,
      is_published,
    };

    const BUCKET_NAME = 'reviews-images';

    if (image_urls && Array.isArray(image_urls)) {
      const { data: currentReview } = await supabaseAdmin.from('reviews').select('image_urls').eq('id', id).single();
      if (currentReview?.image_urls && currentReview.image_urls.length > 0) {
        const oldImageNames = currentReview.image_urls.map((url:string) => url.split('/').pop()).filter(Boolean);
        if (oldImageNames.length > 0) {
          await supabaseAdmin.storage.from(BUCKET_NAME).remove(oldImageNames as string[]);
        }
      }
      updates.image_urls = image_urls;
    }

    const { error } = await supabaseAdmin
      .from('reviews')
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
    const { data: review, error: fetchError } = await supabaseAdmin
      .from('reviews')
      .select('image_urls')
      .eq('id', id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch review for deletion: ${fetchError.message}`);
    }

    const { error: deleteError } = await supabaseAdmin
      .from('reviews')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Database delete error: ${deleteError.message}`);
    }

    if (review?.image_urls && review.image_urls.length > 0) {
      const BUCKET_NAME = 'reviews-images';
      const imageNames = review.image_urls.map((url: string) => url.split('/').pop()).filter(Boolean);
      if (imageNames.length > 0) {
        await supabaseAdmin.storage.from(BUCKET_NAME).remove(imageNames as string[]);
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch(err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
