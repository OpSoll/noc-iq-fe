"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { ADMIN_ROUTES } from "@/components/Navigation";
import {
  getCapabilityForPath,
  hasCapability,
  getModeFromBackend,
  type CapabilityMode,
} from "@/services/capabilities";

// Routes that do not require authentication
const PUBLIC_PATHS = ["/login", "/register"];
// Routes that are always allowed for any authenticated user
const ALWAYS_ALLOWED = ["/setting"];

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const { state, user } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAdminRoute = ADMIN_ROUTES.some((p) => pathname.startsWith(p));
  const isAdmin = user?.role === "admin";
  const isAlwaysAllowed = ALWAYS_ALLOWED.some((p) => pathname.startsWith(p));

  const checkCapability = useCallback(() => {
    if (!user || state !== "authenticated") return true;
    if (isPublic || isAlwaysAllowed) return true;
    const required = getCapabilityForPath(pathname);
    if (!required) return true;
    const mode = getModeFromBackend();
    return hasCapability(user.role, required, mode);
  }, [user, state, isPublic, isAlwaysAllowed, pathname]);

  useEffect(() => {
    if (state === "unauthenticated" && !isPublic) {
      router.replace("/login");
    }
  }, [state, isPublic, router]);

  // Loading — don't flash protected content
  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  // Unauthenticated on a protected route — redirect in progress, render nothing
  if (state === "unauthenticated" && !isPublic) {
    return null;
  }

  // Role-based capability check
  if (state === "authenticated" && user && !isPublic && !isAlwaysAllowed) {
    const required = getCapabilityForPath(pathname);
    if (required && !hasCapability(user.role, required)) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center px-4">
          <div className="rounded-full bg-amber-100 p-3">
            <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 1112 3a9 9 0 017.364 4.636z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Access restricted</h2>
          <p className="text-sm text-slate-500 max-w-md">
            This area is not available with your current permissions.
          </p>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Return to dashboard
          </button>
        </div>
      );
    }
  }

  // Admin route fallback
  if (state === "authenticated" && isAdminRoute && !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold text-slate-800">Access denied</p>
        <p className="text-sm text-slate-500">
          This page is restricted to administrators. Contact your admin if you need access.
        </p>
        <a href="/" className="mt-2 text-sm text-blue-600 underline">
          Return to dashboard
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
