"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api, getAccessToken, setTokens } from "@/lib/api";

interface PendingMutation {
  id: string;
  description: string;
  retry: () => Promise<unknown>;
}

interface SessionExpiryModalProps {
  isOpen: boolean;
  pendingMutations: PendingMutation[];
  onReauthenticated: () => void;
  onDismiss: () => void;
}

export default function SessionExpiryModal({
  isOpen,
  pendingMutations,
  onReauthenticated,
  onDismiss,
}: SessionExpiryModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const submittedRef = useRef(false);

  const handleReauth = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await api.post<{
        access_token: string;
        refresh_token: string;
      }>("/auth/login", { email, password });

      setTokens(res.data.access_token, res.data.refresh_token);
      onReauthenticated();

      // Retry pending mutations
      for (const mutation of pendingMutations) {
        setRetrying(mutation.id);
        try {
          await mutation.retry();
        } catch {
          // individual mutation retry failed, continue with others
        }
      }
      setRetrying(null);
      onDismiss();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Re-authentication failed"
      );
      submittedRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [email, password, pendingMutations, onReauthenticated, onDismiss]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      submittedRef.current = false;
      setEmail("");
      setPassword("");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Session expired"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 1112 3a9 9 0 017.364 4.636z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Session expired</h2>
            <p className="text-sm text-slate-500">
              Your session expired while you had unsaved changes.
            </p>
          </div>
        </div>

        {pendingMutations.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <p className="font-medium">Pending changes ({pendingMutations.length})</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {pendingMutations.map((m) => (
                <li key={m.id}>
                  {m.description}
                  {retrying === m.id && (
                    <span className="ml-1 text-amber-600">retrying...</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600" htmlFor="reauth-email">
              Email
            </label>
            <input
              id="reauth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600" htmlFor="reauth-password">
              Password
            </label>
            <input
              id="reauth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleReauth}
            disabled={loading || !email || !password}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {loading ? "Re-authenticating..." : "Sign in & retry"}
          </button>
          <button
            onClick={() => {
              onDismiss();
              router.push("/login");
            }}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
