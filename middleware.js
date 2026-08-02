import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/"]);

const ADMIN_PREFIXES = [
  "/dashboard",
  "/academic-records",
  "/lesson-plan-review",
  "/monitoring",
  "/class-organization",
  "/sections",
  "/class-assignments",
  "/reports",
  "/user-management",
  "/notifications",
  "/settings",
  "/attendance",
];

const PORTAL_ROLES = new Set(["admin", "teacher", "student"]);

function isPublicPath(pathname) {
  return PUBLIC_PATHS.has(pathname);
}

function isTeacherPath(pathname) {
  return pathname === "/teacher" || pathname.startsWith("/teacher/");
}

function isStudentPath(pathname) {
  return pathname === "/student" || pathname.startsWith("/student/");
}

function isAdminPath(pathname) {
  return ADMIN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function roleHome(role) {
  if (role === "admin") return "/dashboard";
  if (role === "student") return "/student/dashboard";
  return "/teacher/dashboard";
}

/**
 * Resolve portal role from JWT user_metadata first (set at login).
 * Falls back to a single profiles query only when metadata is missing.
 */
async function resolvePortalAccess(supabase, user) {
  const meta = user.user_metadata ?? {};
  const metaRole = meta.portal_role;
  const metaActive = meta.portal_active;

  if (
    PORTAL_ROLES.has(metaRole) &&
    metaActive !== false &&
    metaActive !== "false"
  ) {
    return { role: metaRole, isActive: true, fromMeta: true };
  }

  if (metaActive === false || metaActive === "false") {
    return { role: metaRole ?? null, isActive: false, fromMeta: true };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return { role: null, isActive: false, fromMeta: false };
  }

  return {
    role: profile.role,
    isActive: profile.is_active !== false,
    fromMeta: false,
  };
}

/**
 * Session + role gate for Admin / Teacher / Student portals.
 * Skips API routes. Prefer JWT metadata over an extra profiles round-trip.
 */
export async function middleware(request) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { pathname } = request.nextUrl;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isPublicPath(pathname)) return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const access = await resolvePortalAccess(supabase, user);

  if (!access.isActive || !access.role) {
    await supabase.auth.signOut();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("error", "inactive");
    return NextResponse.redirect(loginUrl);
  }

  const { role } = access;

  // Backfill JWT metadata once when missing so later navigations skip profiles.
  if (!access.fromMeta && PORTAL_ROLES.has(role)) {
    void supabase.auth.updateUser({
      data: {
        portal_role: role,
        portal_active: true,
      },
    });
  }

  if (pathname === "/login" || pathname === "/") {
    const home = request.nextUrl.clone();
    home.pathname = roleHome(role);
    return NextResponse.redirect(home);
  }

  if (isTeacherPath(pathname) && role !== "teacher") {
    const home = request.nextUrl.clone();
    home.pathname = roleHome(role);
    return NextResponse.redirect(home);
  }

  if (isStudentPath(pathname) && role !== "student") {
    const home = request.nextUrl.clone();
    home.pathname = roleHome(role);
    return NextResponse.redirect(home);
  }

  if (isAdminPath(pathname) && role !== "admin") {
    const home = request.nextUrl.clone();
    home.pathname = roleHome(role);
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/academic-records/:path*",
    "/lesson-plan-review/:path*",
    "/monitoring/:path*",
    "/class-organization/:path*",
    "/sections/:path*",
    "/class-assignments/:path*",
    "/reports/:path*",
    "/user-management/:path*",
    "/notifications/:path*",
    "/settings/:path*",
    "/attendance/:path*",
    "/teacher/:path*",
    "/student/:path*",
  ],
};
