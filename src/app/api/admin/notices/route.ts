// src/app/api/admin/notices/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
// v4 as uuidv4 는 더 이상 여기서 필요하지 않습니다.

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc('is_current_user_admin');
  if (error) {
    console.error("Admin check failed in notices API:", error);
    return false;
  }
  return data === true;
}

export async function GET() {
  // GET 로직은 변경 없음
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  // ... (기존 GET 코드 유지)
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // [수정됨] FormData 대신 JSON 본문을 파싱합니다.
    const { title, content, link_url, author_name, is_published, image_urls } = await request.json();

    if (!title || !content) {
      return new NextResponse('Title and Content are required', { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('notices')
      .insert({
        title,
        content,
        link_url,
        image_urls: image_urls && image_urls.length > 0 ? image_urls : null,
        author_name: author_name || 'Admin',
        is_published,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database Error: ${error.message}`);
    }

    return NextResponse.json(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown internal error';
    console.error('Notice POST Error:', errorMessage);
    return new NextResponse(errorMessage, { status: 500 });
  }
}
