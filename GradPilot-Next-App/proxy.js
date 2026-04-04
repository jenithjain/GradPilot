import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(request) {
  const startTime = Date.now();
  
  // Console logging for API requests (actual audit logs created by individual routes)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    console.log('[MIDDLEWARE]', {
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.nextUrl.pathname,
      ip: ip,
      userAgent: (request.headers.get('user-agent') || 'unknown').substring(0, 50),
    });
  }

  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET 
  });

  const { pathname } = request.nextUrl;

  // Public routes
  const publicRoutes = ['/', '/login', '/auth', '/api/auth'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // If user is not authenticated and trying to access protected route
  if (!token && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If user is authenticated but hasn't completed KYC, allow access to dashboard
  // (onboarding is now initiated from the dashboard via "Start Your Journey")

  // If user completed KYC and tries to access onboarding, redirect to dashboard
  if (token && token.hasCompletedKYC && pathname === '/onboarding') {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // If authenticated user tries to access login/auth, redirect to dashboard
  if (token && (pathname === '/login' || pathname === '/auth')) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Continue with the request and add audit tracking headers
  const response = NextResponse.next();
  response.headers.set('x-request-start-time', startTime.toString());
  response.headers.set('x-request-id', crypto.randomUUID());
  
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
