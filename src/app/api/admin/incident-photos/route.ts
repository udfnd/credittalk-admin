// src/app/api/admin/incident-photos/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log("isAdmin: No user found.");
    return false;
  }

  const { data, error } = await supabase.rpc('is_current_user_admin');
  if (error) {
    console.error("isAdmin: RPC call failed:", error);
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
      .from('incident_photos')
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


export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // [수정됨] FormData 대신 JSON 본문을 파싱합니다.
    const { title, description, category, is_published, link_url, image_urls } = await request.json();

    if (!title || !image_urls || image_urls.length === 0) {
      return new NextResponse('Title and at least one image URL are required', { status: 400 });
    }

    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('incident_photos')
      .insert([{
        title,
        description: description || '',
        category: category || '',
        image_urls: image_urls, // 클라이언트에서 직접 업로드한 URL 배열
        is_published,
        uploader_id: null, // 관리자가 직접 업로드하므로 null 처리
        link_url,
      }])
      .select()
      .single();

    if (dbError) {
      throw new Error(`Database Error: ${dbError.message}`);
    }

    return NextResponse.json(dbData);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown internal error';
    return new NextResponse(`Internal Server Error: ${errorMessage}`, { status: 500 });
  }
}
