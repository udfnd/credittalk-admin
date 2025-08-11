// src/app/api/admin/reviews/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

async function getAdminUserId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: isAdminResult } = await supabase.rpc('is_current_user_admin');
  return isAdminResult ? user.id : null;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const adminUserId = await getAdminUserId(supabase);

  if (!adminUserId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { title, content, rating, is_published, image_urls } = await request.json();

    if (!title || !content) {
      return new NextResponse('Title and content are required', { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        title,
        content,
        rating,
        is_published,
        image_urls: image_urls && image_urls.length > 0 ? image_urls : null,
        user_id: adminUserId,
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
