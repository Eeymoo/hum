import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const token = searchParams.get('token')

  // 如果是带 token 的 dashboard 访问，注入 x-share-token header
  if (token && pathname.startsWith('/dashboard')) {
    const response = NextResponse.next()
    response.headers.set('x-share-token', token)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*']
}
