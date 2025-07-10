// src/app/api/admin/statistics/scammer-details/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// 관리자 여부 확인
async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

export async function GET() {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 이미 복호화된 데이터를 제공하는 `decrypted_scammer_reports` 뷰를 사용합니다.
    const { data, error } = await supabaseAdmin
      .from('decrypted_scammer_reports')
      .select('id, phone_numbers, category, damage_accounts, nickname')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching decrypted scammer reports:', error);
      throw error;
    }

    // 클라이언트에서 사용하기 쉽도록 데이터를 가공합니다.
    const result = data.map(report => ({
      id: report.id,
      category: report.category,
      nickname: report.nickname,
      phone_numbers: report.phone_numbers, // JSON 배열 형태 (이미 text 배열)
      damage_accounts: report.damage_accounts, // JSON 배열 형태
    }));

    return NextResponse.json(result);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in scammer-details route:', errorMessage);
    return new NextResponse(errorMessage, { status: 500 });
  }
}
