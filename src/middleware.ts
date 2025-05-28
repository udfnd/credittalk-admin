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
  const pathname = request.nextUrl.pathname; // 현재 경로 가져오기

  if (pathname === '/') {
    if (session) {
      const userIsAdmin = await isAdmin(supabase);
      if (userIsAdmin) {
        return NextResponse.redirect(new URL('/admin', request.url));
      } else {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL('/login', request.url));
      }
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  // ======================================

  // /admin 경로 접근 시 (기존 로직)
  if (pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const userIsAdmin = await isAdmin(supabase);

    if (!userIsAdmin) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // 로그인 페이지 접근 시 (기존 로직)
  if (pathname === '/login' && session) {
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
  ],
}
