import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/uploads/(.*)'
]);

const clerkHandler = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
}, {
  // Clerk merges these with the directives it needs (its own domains, Stripe, Turnstile).
  // ponytail: script-src still allows 'unsafe-inline' because pages are statically rendered;
  // switch to `strict: true` (nonces) once the app pages render dynamically.
  contentSecurityPolicy: {
    directives: {
      'img-src': ['https:', 'data:', 'blob:'],          // OG images, favicons, pasted/inline uploads
      'media-src': ['self', 'https:', 'data:', 'blob:'],
      'frame-src': ['data:', 'blob:', 'https://storage.googleapis.com'], // PDF preview
      'style-src': ['https://fonts.googleapis.com'],
      'font-src': ['self', 'https://fonts.gstatic.com', 'data:'],
      'object-src': ['none'],
      'base-uri': ['self'],
      'frame-ancestors': ['self']
    }
  }
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // If Clerk is not configured in environment, permit all requests (offline dev mode)
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    return NextResponse.next();
  }

  return clerkHandler(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)'
  ]
};
