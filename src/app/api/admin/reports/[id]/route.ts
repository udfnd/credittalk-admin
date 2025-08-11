// src/app/api/admin/reports/[id]/route.ts
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

// URL에서 파일 경로를 추출하는 헬퍼 함수
const getPathFromUrl = (bucketName: string, url: string): string | null => {
  try {
    const path = new URL(url).pathname.split(`/v1/object/public/${bucketName}/`)[1];
    return path ? decodeURIComponent(path) : null;
  } catch (error) {
    console.error('Invalid URL:', url, error);
    return null;
  }
};

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 1. 삭제할 신고 기록을 조회하여 연결된 파일 URL들을 가져옵니다.
    const { data: report, error: fetchError } = await supabaseAdmin
      .from('scammer_reports')
      .select('nickname_evidence_url, traded_item_image_urls')
      .eq('id', id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch report for deletion: ${fetchError.message}`);
    }

    // 2. 데이터베이스에서 신고 기록을 삭제합니다.
    const { error: deleteError } = await supabaseAdmin
      .from('scammer_reports')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Database delete error: ${deleteError.message}`);
    }

    // 3. 스토리지에서 관련 증거 파일들을 삭제합니다.
    if (report) {
      const BUCKET_NAME = 'report-evidence';
      const pathsToDelete: string[] = [];

      if (report.nickname_evidence_url) {
        const path = getPathFromUrl(BUCKET_NAME, report.nickname_evidence_url);
        if (path) pathsToDelete.push(path);
      }

      if (report.traded_item_image_urls && Array.isArray(report.traded_item_image_urls)) {
        report.traded_item_image_urls.forEach(url => {
          const path = getPathFromUrl(BUCKET_NAME, url);
          if (path) pathsToDelete.push(path);
        });
      }

      if (pathsToDelete.length > 0) {
        const { error: storageError } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .remove(pathsToDelete);

        if (storageError) {
          // DB 기록은 삭제되었으므로 경고만 로그에 남기고 계속 진행합니다.
          console.warn(`Could not delete some storage objects for report ${id}:`, storageError.message);
        }
      }
    }

    return new NextResponse(null, { status: 204 }); // No Content
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
