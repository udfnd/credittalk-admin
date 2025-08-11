// src/app/api/admin/new-crime-cases/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

async function getAdminUser(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: isAdminResult, error } = await supabase.rpc('is_current_user_admin');
  if (error) {
    console.error("Admin check failed in new-crime-cases API:", error);
    return null;
  }
  return isAdminResult ? user : null;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const adminUser = await getAdminUser(supabase);

  if (!adminUser) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { title, method, is_published, image_urls, link_url, category } = await request.json();

    if (!title || !method) {
      return new NextResponse('Title and Method are required', { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('new_crime_cases')
      .insert({
        title,
        method,
        image_urls: image_urls && image_urls.length > 0 ? image_urls : null,
        is_published,
        user_id: adminUser.id,
        link_url,
        category,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database Error: ${error.message}`);
    }

    return NextResponse.json(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown internal error';
    console.error('New Crime Case POST Error:', errorMessage);
    return new NextResponse(errorMessage, { status: 500 });
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) return new NextResponse('Forbidden', { status: 403 });

  try {
    const { data, error } = await supabaseAdmin
      .from('new_crime_cases')
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
