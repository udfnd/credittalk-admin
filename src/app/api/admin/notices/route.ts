import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server'; // 인증 확인용
import { NextResponse } from 'next/server';

async function isAdmin(request: Request): Promise<boolean> {
  // 서버 컴포넌트용 클라이언트를 사용하여 쿠키 기반으로 세션 확인
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc('is_current_user_admin');
  return !error && data === true;
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { title, content, author_name, is_published } = await request.json();

    if (!title || !content) {
      return new NextResponse('Title and Content are required', { status: 400 });
    }

    // service_role 클라이언트를 사용하여 RLS를 우회하고 데이터 삽입
    const { data, error } = await supabaseAdmin
      .from('notices')
      .insert([{
        title,
        content,
        author_name: author_name || 'Admin', // 기본값 설정
        is_published: is_published !== undefined ? is_published : true,
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase Error:', error);
      return new NextResponse(`Database Error: ${error.message}`, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (err: any) {
    console.error('API Error:', err);
    return new NextResponse(`Internal Server Error: ${err.message}`, { status: 500 });
  }
}
