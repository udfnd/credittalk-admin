import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

async function isAdmin(request: Request): Promise<boolean> {
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
    // FormData를 사용하므로 request.json() 대신 request.formData() 사용
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const imageFile = formData.get('imageFile') as File;
    const is_published = formData.get('is_published') === 'true';

    if (!title || !imageFile) {
      return new NextResponse('Title and Image File are required', { status: 400 });
    }

    // 1. 이미지 업로드 (service_role 클라이언트 사용)
    const fileName = `<span class="math-inline">\{Date\.now\(\)\}\-</span>{imageFile.name.replace(/\s/g, '_')}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('incident-photos') // 버킷 이름
      .upload(fileName, imageFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase Storage Error:', uploadError);
      return new NextResponse(`Storage Error: ${uploadError.message}`, { status: 500 });
    }

    // 2. 이미지 URL 가져오기
    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from('incident-photos')
      .getPublicUrl(uploadData.path);

    if (!publicUrl) {
      return new NextResponse('Could not get public URL', { status: 500 });
    }

    // 3. 데이터베이스에 정보 저장 (service_role 클라이언트 사용)
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('incident_photos')
      .insert([{
        title,
        description,
        category,
        image_url: publicUrl,
        is_published,
        // uploader_id는 현재 로그인한 관리자 ID를 넣거나 null로 둘 수 있습니다.
        // auth.uid()는 service_role에서는 작동하지 않으므로,
        // 필요하다면 클라이언트에서 ID를 넘겨받아야 하지만, 여기서는 null로 둡니다.
        uploader_id: null,
      }])
      .select()
      .single();

    if (dbError) {
      console.error('Supabase DB Error:', dbError);
      // 업로드된 파일 롤백? (선택 사항)
      await supabaseAdmin.storage.from('incident-photos').remove([fileName]);
      return new NextResponse(`Database Error: ${dbError.message}`, { status: 500 });
    }

    return NextResponse.json(dbData);

  } catch (err: any) {
    console.error('API Error:', err);
    return new NextResponse(`Internal Server Error: ${err.message}`, { status: 500 });
  }
}
