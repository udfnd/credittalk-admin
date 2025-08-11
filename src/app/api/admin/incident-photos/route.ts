// src/app/api/admin/incident-photos/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

async function getAdminUser() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) return null;
  return user;
}

export async function POST(request: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return new NextResponse(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { title, description, category, is_published, link_url, image_urls } = await request.json();

    if (!title || !image_urls || image_urls.length === 0) {
      return new NextResponse(JSON.stringify({ message: 'Title and at least one image URL are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('incident_photos')
      .insert([{
        title,
        description: description || null,
        category: category || null,
        image_urls,
        is_published,
        uploader_id: adminUser.id,
        link_url: link_url || null,
      }])
      .select()
      .single();

    if (dbError) {
      throw new Error(`Database Error: ${dbError.message}`);
    }

    return NextResponse.json(dbData);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown internal error';
    return new NextResponse(JSON.stringify({ message: errorMessage }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function GET() {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return new NextResponse(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('incident_photos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(JSON.stringify({ message: errorMessage }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
