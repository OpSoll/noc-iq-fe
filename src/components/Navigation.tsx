"use client";

import Link from "next/link";
import { useSession } from "@/hooks/useSession";
import { useAccessibility, type AccessibilityMode } from "@/providers/accessibility";

// Routes only visible to admin users
const ADMIN_ROUTES = ["/webhooks", "/config"];

const A11Y_MODES: { value: AccessibilityMode; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "high-contrast", label: "High contrast" },
  { value: "reduced-motion", label: "Reduced motion" },
];

const Navigation = () => {
  const { state, user, logout } = useSession();
  const { mode, setMode } = useAccessibility();
  const isAdmin = user?.role === "admin";

  return (
    <nav style={{ padding: "1rem", borderBottom: "1px solid #ccc" }} className="flex items-center justify-between">
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/">Dashboard</Link>
        <span>|</span>
        <Link href="/outages">Outages</Link>
        <span>|</span>
        <Link href="/bulk-import">Bulk Import</Link>
        <span>|</span>
        <Link href="/payments">Payments</Link>
        <span>|</span>
        <Link href="/setting">Settings</Link>
        {isAdmin && (
          <>
            <span>|</span>
            <Link href="/config">SLA Config</Link>
            <span>|</span>
            <Link href="/webhooks">Webhooks</Link>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-600">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as AccessibilityMode)}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500"
          aria-label="Accessibility mode"
        >
          {A11Y_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {state === "loading" && (
          <span className="text-slate-400">Checking session…</span>
        )}
        {state === "authenticated" && user && (
          <span className="flex items-center gap-3">
            <span>{user.email}</span>
            {isAdmin && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                admin
              </span>
            )}
            <button
              onClick={() => void logout()}
              className="rounded border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-100"
            >
              Sign out
            </button>
          </span>
        )}
        {state === "unauthenticated" && (
          <Link
            href="/login"
            className="rounded border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-100"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navigation;

// Export admin route list so RouteGuard can use it
export { ADMIN_ROUTES };
