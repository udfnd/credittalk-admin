import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

async function isAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };

  const { data, error } = await supabase.rpc('is_current_user_admin');
  if (error || data !== true) return { ok: false as const };
  return { ok: true as const };
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await isAdmin();
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });

  const idNum = Number(id);
  if (!Number.isFinite(idNum)) {
    return new NextResponse('invalid id', { status: 400 });
  }

  try {
    // 1) (선택) decrypted 뷰/테이블에서 먼저 삭제 시도
    let deletedFromDecrypted = 0;
    try {
      const { error, count } = await supabaseAdmin
        .from('decypted_scammer_reports')        // 실제 이름 확인 필요
        .delete({ count: 'exact' })               // ✅ count 옵션은 여기!
        .eq('id', idNum)
        .select('id');                            // ✅ .select는 인자 1개만
      if (!error) deletedFromDecrypted = count ?? 0;
    } catch {
      // 뷰 삭제 불가/존재하지 않음 등은 무시
    }

    // 2) 원본 테이블에서 삭제 (핵심)
    const { error: err2, count: deletedFromOriginal } = await supabaseAdmin
      .from('scammer_reports')
      .delete({ count: 'exact' })                 // ✅ 여기에도 count 옵션
      .eq('id', idNum)
      .select('id');

    if (err2) throw err2;

    return NextResponse.json({
      ok: true,
      deleted_from: {
        decrypted: deletedFromDecrypted,
        original: deletedFromOriginal ?? 0,
      },
    });
  } catch (e) {
    const msg = (e as { message?: string }).message ?? 'internal error';
    return new NextResponse(msg, { status: 500 });
  }
}

