// src/app/api/admin/arrest-news/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

interface ArrestNewsUpdatePayload {
  title: string;
  content: string | null;
  author_name: string | null;
  is_published: boolean;
  link_url?: string | null;
  image_urls?: string[];
  category?: string | null;
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
    .from('arrest_news')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error(`Error fetching arrest news ID ${id}:`, error.message);
    return new NextResponse(error.message, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { title, content, author_name, is_published, link_url, image_urls, category } = await request.json();

    const updates: Partial<ArrestNewsUpdatePayload> = {
      title,
      content,
      author_name,
      is_published,
      link_url,
      category,
    };

    const BUCKET_NAME = 'arrest-news-images';

    if (image_urls && Array.isArray(image_urls)) {
      const { data: currentNews } = await supabaseAdmin.from('arrest_news').select('image_urls').eq('id', id).single();

      if (currentNews) {
        const oldImageUrls: string[] = currentNews.image_urls || [];
        const newImageUrls: string[] = image_urls;

        const urlsToDelete = oldImageUrls.filter((url: string) => !newImageUrls.includes(url));

        if (urlsToDelete.length > 0) {
          const oldImageNames = urlsToDelete.map((url: string) => {
            try {
              const pathname = new URL(url).pathname;
              return pathname.substring(pathname.lastIndexOf('/') + 1);
            } catch {
              return null;
            }
          }).filter(Boolean);

          if (oldImageNames.length > 0) {
            await supabaseAdmin.storage.from(BUCKET_NAME).remove(oldImageNames as string[]);
          }
        }
      }
      updates.image_urls = image_urls;
    } else if (image_urls === null || (Array.isArray(image_urls) && image_urls.length === 0)) {
      const { data: currentNews } = await supabaseAdmin.from('arrest_news').select('image_urls').eq('id', id).single();
      if (currentNews?.image_urls && currentNews.image_urls.length > 0) {
        const oldImageNames = currentNews.image_urls.map((url: string) => {
          try {
            const pathname = new URL(url).pathname;
            return pathname.substring(pathname.lastIndexOf('/') + 1);
          } catch {
            return null;
          }
        }).filter(Boolean);
        if (oldImageNames.length > 0) {
          await supabaseAdmin.storage.from(BUCKET_NAME).remove(oldImageNames as string[]);
        }
      }
      updates.image_urls = [];
    }


    const { error } = await supabaseAdmin
      .from('arrest_news')
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

  const { data: newsItem, error: fetchError } = await supabaseAdmin
    .from('arrest_news')
    .select('image_urls')
    .eq('id', id)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    return new NextResponse(fetchError.message, { status: 500 });
  }

  const { error } = await supabaseAdmin
    .from('arrest_news')
    .delete()
    .eq('id', id);

  if (error) return new NextResponse(error.message, { status: 500 });

  if (newsItem?.image_urls && newsItem.image_urls.length > 0) {
    const BUCKET_NAME = 'arrest-news-images';
    const imageNames = newsItem.image_urls.map((url: string) => {
      try {
        const pathname = new URL(url).pathname;
        return pathname.substring(pathname.lastIndexOf('/') + 1);
      } catch {
        return null;
      }
    }).filter(Boolean);
    if (imageNames.length > 0) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove(imageNames as string[]);
    }
  }

  return new NextResponse(null, { status: 204 });
}
