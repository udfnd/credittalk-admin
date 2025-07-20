// src/app/api/admin/pin/route.ts
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

// API 요청의 'type' 파라미터를 실제 DB 테이블 이름으로 매핑합니다.
const TABLE_MAP: { [key: string]: string } = {
  'notices': 'notices',
  'arrest-news': 'arrest_news',
  'reviews': 'reviews',
  'incident-photos': 'incident_photos',
  'new-crime-cases': 'new_crime_cases',
  'posts': 'community_posts',
};

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { type, id, pin } = await request.json();
    const tableName = TABLE_MAP[type];

    if (!tableName || typeof id === 'undefined' || typeof pin === 'undefined') {
      return new NextResponse('Invalid request body. "type", "id", and "pin" are required.', { status: 400 });
    }

    const updates = {
      is_pinned: pin,
      pinned_at: pin ? new Date().toISOString() : null,
    };

    const { error } = await supabaseAdmin
      .from(tableName)
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error("Pin API Error:", error);
      throw error;
    }

    return NextResponse.json({ message: `Successfully ${pin ? 'pinned' : 'unpinned'} the post.` });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
