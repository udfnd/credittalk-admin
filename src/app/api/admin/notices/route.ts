import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies(); // d.ts 파일 기준 await 사용
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
    const { title, content, author_name, is_published } = await request.json();

    if (!title || !content) {
      return new NextResponse('Title and Content are required', { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('notices')
      .insert([{
        title,
        content,
        author_name: author_name || 'Admin',
        is_published: is_published !== undefined ? is_published : true,
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase Error:', error);
      return new NextResponse(`Database Error: ${error.message}`, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (err) { // any 타입 제거 및 타입 체크
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
