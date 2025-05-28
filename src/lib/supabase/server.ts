import { createServerClient, type CookieOptions } from '@supabase/ssr'
// cookies() 함수 대신, 타입만 가져옵니다.
import { type ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

// createClient 함수가 해결된 ReadonlyRequestCookies 객체를 인자로 받도록 합니다.
export function createClient(cookieStore: ReadonlyRequestCookies) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // 쿠키 저장소는 이미 해결되었으므로, 직접 set 호출
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          // 쿠키 저장소는 이미 해결되었으므로, 직접 set 호출 (삭제는 빈 값으로 설정)
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}
