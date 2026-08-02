import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { councilAuthFetch } from "@/lib/supabase/fetch";

function cspFor(nonce: string, supabaseUrl: string) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const supabaseOrigin = (() => {
    try {
      return new URL(supabaseUrl).origin;
    } catch {
      return "";
    }
  })();
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDevelopment ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self'",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  const localDevelopmentRequest = process.env.NODE_ENV !== "production"
    && (request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1");
  const requestHeaders = new Headers(request.headers);
  const csp = cspFor(nonce, supabaseUrl);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  if (supabaseUrl && supabaseKey && !localDevelopmentRequest) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      global: { fetch: councilAuthFetch },
      cookieOptions: {
        name: "what-bin-council-auth",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              path: "/",
            });
          });
        },
      },
    });
    try {
      await supabase.auth.getClaims();
    } catch {
      // A temporary auth/JWKS outage must not hold every console request open.
      // Protected server pages still fail closed when they check the identity.
    }
  }

  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|manifest.webmanifest|sw.js|pwa-icon).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
