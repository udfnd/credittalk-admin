import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// is_current_user_admin 함수를 호출하거나,
// 사용자 정보를 가져와 is_admin 필드를 확인합니다.
async function isAdmin(supabase: any): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // users 테이블에서 is_admin 값을 직접 조회 (service_role 필요 없음)
  // 단, users 테이블에 auth_user_id = auth.uid() RLS가 있어야 합니다.
  // 또는, admin 클라이언트를 사용하여 조회할 수도 있지만, 미들웨어에서는
  // 사용자 세션을 기반으로 확인하는 것이 일반적입니다.
  // 여기서는 is_current_user_admin RPC를 호출합니다.
  const { data, error } = await supabase.rpc('is_current_user_admin');

  if (error) {
    console.error('Admin check error:', error);
    return false;
  }

  return data === true;
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
      // 로그인되지 않았으면 로그인 페이지로 리다이렉트
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const userIsAdmin = await isAdmin(supabase);

    if (!userIsAdmin) {
      // 관리자가 아니면 접근 불가 페이지 또는 홈으로 리다이렉트
      console.warn(`Non-admin user (${session.user.email}) tried to access /admin`);
      return NextResponse.redirect(new URL('/', request.url)); // 홈으로 리다이렉트 예시
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
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/admin/:path*',
    '/login',
  ],
}
