"use client";

import { useState } from "react";
import { useSession } from "@/hooks/useSession";
import { useRouter } from "next/navigation";
import { useMutationToast } from "@/hooks/useMutationToast";
import { api } from "@/lib/api";

export function SessionManagementCard() {
  const { state: sessionState, logout } = useSession();
  const router = useRouter();
  const [sessionActionLoading, setSessionActionLoading] = useState<string | null>(null);

  const signOutMutation = useMutationToast({
    mutationFn: async () => {
      await logout();
      return true;
    },
    successMessage: "Signed out successfully.",
    errorMessage: () => "Sign out failed. Please try again.",
    onSuccess: () => {
      router.replace("/login");
    },
  });

  const logoutAllMutation = useMutationToast({
    mutationFn: async () => {
      try {
        await api.post("/auth/logout-all");
      } catch (err) {
        if ((err as { response?: { status?: number } }).response?.status !== 404) {
          throw new Error("Could not revoke all sessions.");
        }
      }
      await logout();
      return true;
    },
    successMessage: "All sessions revoked successfully.",
    errorMessage: () => "Could not revoke all sessions. Please try again.",
    onSuccess: () => {
      router.replace("/login");
    },
  });

  async function handleSignOut() {
    setSessionActionLoading("signout");
    signOutMutation.mutate(undefined);
    setSessionActionLoading(null);
  }

  async function handleLogoutAll() {
    setSessionActionLoading("logout-all");
    logoutAllMutation.mutate(undefined);
    setSessionActionLoading(null);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Session Management</h2>
      <p className="mt-1 text-sm text-slate-500">
        Control your active session and understand token refresh behaviour.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm space-y-3">
          <h3 className="font-medium text-slate-900">Sign out of this session</h3>
          <p className="text-slate-500">
            Ends your current session and clears stored tokens from this browser. You will be
            redirected to the sign-in page.
          </p>
          <button
            onClick={() => void handleSignOut()}
            disabled={sessionState !== "authenticated" || sessionActionLoading !== null}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {sessionActionLoading === "signout" ? "Signing out…" : "Sign out"}
          </button>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm space-y-3">
          <h3 className="font-medium text-slate-900">Revoke all sessions</h3>
          <p className="text-slate-500">
            Invalidates all active refresh tokens for your account across every device. Use this
            if you suspect unauthorised access.
          </p>
          <button
            onClick={() => void handleLogoutAll()}
            disabled={sessionState !== "authenticated" || sessionActionLoading !== null}
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {sessionActionLoading === "logout-all" ? "Revoking…" : "Revoke all sessions"}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 space-y-1">
        <p className="font-medium">How session refresh works</p>
        <p>
          Your access token is short-lived. When it expires the app automatically exchanges your
          refresh token for a new pair — you stay signed in without any action required.
        </p>
        <p>
          If the refresh fails (token revoked, network error, or server restart) you will see a
          &ldquo;Session expired&rdquo; message and be redirected to sign in again. No data is
          lost; simply sign back in to continue.
        </p>
      </div>
    </section>
  );
}
