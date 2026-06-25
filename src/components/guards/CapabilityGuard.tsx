"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import {
  getCapabilityForPath,
  hasCapability,
  type CapabilityMode,
} from "@/services/capabilities";

interface CapabilityGuardProps {
  children: React.ReactNode;
  mode?: CapabilityMode;
}

export default function CapabilityGuard({ children, mode }: CapabilityGuardProps) {
  const { user, state } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (state !== "authenticated" || !user) return;
    const required = getCapabilityForPath(pathname);
    if (!required) return;
    if (!hasCapability(user.role, required, mode)) {
      router.replace("/");
    }
  }, [state, user, pathname, router, mode]);

  if (state !== "authenticated") return <>{children}</>;

  const required = getCapabilityForPath(pathname);
  if (required && user && !hasCapability(user.role, required, mode)) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center px-4">
        <div className="rounded-full bg-amber-100 p-3">
          <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 1112 3a9 9 0 017.364 4.636z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-800">Access restricted</h2>
        <p className="text-sm text-slate-500 max-w-md">
          This area is not available with your current permissions. Contact your administrator if you need access.
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

  return <>{children}</>;
}
