import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'

async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase.rpc('is_current_user_admin');

    if (error) {
      console.error('Admin check error:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('Error during admin check:', err);
    return false;
  }
}


export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.delete({
            name,
            ...options,
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession();

  // /admin 경로 접근 시
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const userIsAdmin = await isAdmin(supabase);

    if (!userIsAdmin) {
      console.warn(`Non-admin user (${session?.user?.email ?? 'Unknown'}) tried to access /admin`);
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // 로그인 페이지 접근 시, 이미 로그인했다면 어드민 페이지로
  if (request.nextUrl.pathname === '/login' && session) {
    const userIsAdmin = await isAdmin(supabase);
    if (userIsAdmin) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/admin/:path*',
    '/login',
  ],
}
