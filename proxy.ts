import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { RESTAURANT_SLUG } from "./app/config/restaurant";

/**
 * Server-side gate for the admin area (Next.js 16 "proxy", formerly "middleware").
 *
 *  1. The visitor must be signed in: the session cookie is verified with
 *     Supabase Auth on every request (getUser, not just reading the cookie).
 *  2. The user must be a member of `restaurant_staff` for this restaurant.
 *
 * Database Row Level Security enforces the same rules again on every query,
 * so even a bypassed UI or proxy cannot read or change another user's data.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 1) Authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/?auth=required", request.url));
  }

  // 2) Authorisation (role check against restaurant_staff)
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("slug", RESTAURANT_SLUG)
    .maybeSingle();

  if (!restaurant) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const { data: staff } = await supabase
    .from("restaurant_staff")
    .select("role")
    .eq("restaurant_id", restaurant.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staff) {
    return NextResponse.redirect(new URL("/?forbidden=1", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};