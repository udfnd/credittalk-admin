// src/app/api/admin/arrest-news/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc('is_current_user_admin');
  if (error) {
    console.error("Admin check failed in arrest-news API:", error);
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
      .from('arrest_news')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}

// 새로운 검거소식 생성
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { title, content, author_name, is_published, image_urls, link_url } = await request.json();

    if (!title) {
      return new NextResponse('Title is required', { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('arrest_news')
      .insert({
        title,
        content: content || null,
        author_name: author_name || '관리자',
        is_published,
        image_urls: image_urls && image_urls.length > 0 ? image_urls : null,
        link_url,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database Error: ${error.message}`);
    }

    return NextResponse.json(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown internal error';
    console.error('Arrest News POST Error:', errorMessage);
    return new NextResponse(errorMessage, { status: 500 });
  }
}
