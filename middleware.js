import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/", "/login/reset-password"]);
const FIRST_LOGIN_PATH = "/login/first-login";
const STAFF_ROLES = new Set(["admin", "teacher"]);

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
 * Students can use JWT role only. Teacher / Head Teacher always read
 * profiles so a stale JWT cannot skip first-login (password + Terms).
 */
async function resolvePortalAccess(supabase, user) {
  const meta = user.user_metadata ?? {};
  const metaRole = meta.portal_role;
  const metaActive = meta.portal_active;

  if (metaActive === false || metaActive === "false") {
    return {
      role: metaRole ?? null,
      isActive: false,
      needsFirstLogin: false,
    };
  }

  if (metaRole === "student" && metaActive !== false && metaActive !== "false") {
    return {
      role: "student",
      isActive: true,
      needsFirstLogin: false,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, must_change_password, accepted_terms_at, temp_password")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return {
      role: PORTAL_ROLES.has(metaRole) ? metaRole : null,
      isActive: false,
      needsFirstLogin: false,
    };
  }

  const role = profile.role;
  const isStaff = STAFF_ROLES.has(role);
  const mustChange = Boolean(profile.must_change_password);
  const hasTempPassword = Boolean(String(profile.temp_password ?? "").trim());
  const acceptedTerms = Boolean(profile.accepted_terms_at);
  const needsFirstLogin =
    isStaff && (mustChange || hasTempPassword || (mustChange && !acceptedTerms));

  return {
    role,
    isActive: profile.is_active !== false,
    needsFirstLogin,
  };
}

/**
 * Session + role gate for Admin / Teacher / Student portals.
 * Staff first-login is always decided from the profiles row, not JWT.
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

  const { role, needsFirstLogin } = access;

  if (PORTAL_ROLES.has(role)) {
    void supabase.auth.updateUser({
      data: {
        portal_role: role,
        portal_active: true,
        must_change_password: Boolean(needsFirstLogin),
      },
    });
  }

  if (needsFirstLogin && pathname !== FIRST_LOGIN_PATH) {
    const firstLogin = request.nextUrl.clone();
    firstLogin.pathname = FIRST_LOGIN_PATH;
    firstLogin.search = "";
    return NextResponse.redirect(firstLogin);
  }

  if (!needsFirstLogin && pathname === FIRST_LOGIN_PATH) {
    const home = request.nextUrl.clone();
    home.pathname = roleHome(role);
    home.search = "";
    return NextResponse.redirect(home);
  }

  if (pathname === "/login" || pathname === "/") {
    if (pathname === "/login" && request.nextUrl.searchParams.get("reset") === "1") {
      return response;
    }
    const home = request.nextUrl.clone();
    home.pathname = needsFirstLogin ? FIRST_LOGIN_PATH : roleHome(role);
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
    "/login/reset-password",
    "/login/first-login",
    "/dashboard",
    "/dashboard/:path*",
    "/teacher",
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
