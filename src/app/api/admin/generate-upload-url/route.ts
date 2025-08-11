// src/app/api/admin/generate-upload-url/route.ts
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

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return new NextResponse(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { bucketName, filePath } = await request.json();
    if (!bucketName || !filePath) {
      return new NextResponse(JSON.stringify({ message: 'bucketName and filePath are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 1. 업로드를 위한 Presigned URL 생성 (유효시간 1분)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from(bucketName)
      .createSignedUploadUrl(filePath);

    if (signedUrlError) {
      throw new Error(`Failed to create signed upload URL: ${signedUrlError.message}`);
    }

    // 2. DB에 저장될 최종 공개 URL 생성
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return NextResponse.json({
      presignedUrl: signedUrlData.signedUrl,
      publicUrl: publicUrl
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(JSON.stringify({ message: errorMessage }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
