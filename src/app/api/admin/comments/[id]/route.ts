// src/app/api/admin/comments/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

async function isRequestFromAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } =await  params;

  if (!(await isRequestFromAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  if (!id) {
    return new NextResponse('Comment ID is required', { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('comments')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return new NextResponse(null, { status: 204 }); // No Content
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error deleting comment with id ${id}:`, errorMessage);
    return new NextResponse(errorMessage, { status: 500 });
  }
}
