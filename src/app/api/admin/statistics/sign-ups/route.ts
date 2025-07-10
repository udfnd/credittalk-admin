// src/app/api/admin/statistics/sign-ups/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const dailySignUps = data.reduce((acc, user) => {
      const date = new Date(user.created_at).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const result = Object.entries(dailySignUps)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
