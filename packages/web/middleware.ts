import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const token = searchParams.get('token')

  // 如果 URL 中有 ?token=，注入 x-share-token header 并清除 URL 中的 token
  if (token) {
    const url = request.nextUrl.clone()
    url.searchParams.delete('token')

    // 对 dashboard 路由保留原有行为（注入 header 但不 rewrite）
    if (pathname.startsWith('/dashboard')) {
      const response = NextResponse.next()
      response.headers.set('x-share-token', token)
      return response
    }

    // API 路由：rewrite 到无 token 的 URL，同时注入 header
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.rewrite(url)
      response.headers.set('x-share-token', token)
      return response
    }

    // 其他带 token 的页面路由也清除 token 并注入 header
    const response = NextResponse.redirect(url)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
}
