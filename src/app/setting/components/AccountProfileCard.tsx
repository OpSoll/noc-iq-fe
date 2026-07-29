"use client";

import { useSession } from "@/hooks/useSession";

export function AccountProfileCard() {
  const { state: sessionState, user: sessionUser } = useSession();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Account Profile</h2>
      <p className="mt-1 text-sm text-slate-500">Current session identity and metadata.</p>
      {sessionState === "loading" && (
        <p className="mt-4 text-sm text-slate-400">Loading session…</p>
      )}
      {sessionState === "unauthenticated" && (
        <p className="mt-4 text-sm text-slate-500">Not signed in.</p>
      )}
      {sessionState === "authenticated" && sessionUser && (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          {[
            { label: "Email", value: sessionUser.email },
            { label: "Role", value: sessionUser.role },
            { label: "Full name", value: sessionUser.full_name ?? "—" },
            { label: "User ID", value: sessionUser.id },
            { label: "Wallet", value: sessionUser.stellar_wallet ?? "Not linked" },
            {
              label: "Member since",
              value: sessionUser.created_at
                ? new Date(sessionUser.created_at).toLocaleDateString()
                : "—",
            },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-1 truncate font-medium text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
