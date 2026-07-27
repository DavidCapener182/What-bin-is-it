import { NextResponse } from "next/server";

import { createCouncilSupabaseServerClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/validation";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeReturnPath(requestUrl.searchParams.get("next") ?? undefined);
  if (!code || code.length > 2048) {
    return NextResponse.redirect(new URL("/login?auth=invalid", requestUrl.origin));
  }
  const supabase = await createCouncilSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?auth=expired", requestUrl.origin));
  }
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
