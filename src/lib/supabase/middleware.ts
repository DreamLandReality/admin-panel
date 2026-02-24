import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        env.SUPABASE_URL,
        env.SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const isAuthRoute = request.nextUrl.pathname.startsWith('/login')

    // Not logged in and not on login page
    if (!user && !isAuthRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('returnUrl', request.nextUrl.pathname)
        return NextResponse.redirect(url)
    }

    // Logged in but not admin
    if (user && user.app_metadata?.user_role !== 'admin' && !isAuthRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('error', 'unauthorized')
        // We sign them out so they can try again if they want, but usually handle this client-side too.
        return NextResponse.redirect(url)
    }

    // Logged in and on login route -> redirect to home
    if (user && isAuthRoute) {
        const returnUrl = request.nextUrl.searchParams.get('returnUrl')
        const safeUrl = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/'
        const url = request.nextUrl.clone()
        url.pathname = safeUrl
        url.search = ''
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
