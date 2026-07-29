"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useWalletDetail, useWalletStatus, useWalletBalance } from "@/hooks/useWallet";
import { useCreateWallet, useLinkWallet } from "@/hooks/useWalletMutations";
import { WalletAddress } from "@/components/wallet/WalletAddress";
import { WalletHealthBadge } from "@/components/wallet/WalletHealthBadge";
import { AccountProfileCard } from "./components/AccountProfileCard";
import { SessionManagementCard } from "./components/SessionManagementCard";
import { WalletReadinessCard } from "./components/WalletReadinessCard";
import { AccountSessionFormCard } from "./components/AccountSessionFormCard";

type AuthUser = {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
};

type AuthSessionResponse = {
  access_token: string;
  user: AuthUser;
};

export default function SettingsPage() {
  const toast = useToast();
  const createWalletMutation = useCreateWallet();
  const linkWalletMutation = useLinkWallet();

  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [walletForm, setWalletForm] = useState({
    user_id: "",
    public_key: "",
    funded: false,
    trustline_ready: false,
  });

  const activeUserId = useMemo(
    () => currentUser?.id ?? (walletForm.user_id.trim() || undefined),
    [currentUser?.id, walletForm.user_id],
  );

  const [requestedUserId, setRequestedUserId] = useState<string | undefined>(undefined);
  const [requestedAddressState, setRequestedAddressState] = useState<string | undefined>(undefined);

  const walletQuery = useWalletDetail(requestedUserId);
  const walletStatusQuery = useWalletStatus(requestedUserId);
  const walletBalanceQuery = useWalletBalance(requestedAddressState);

  const wallet = walletQuery.data ?? null;
  const walletStatus = walletStatusQuery.data ?? null;
  const walletBalance = walletBalanceQuery.data ?? null;

  const walletAssetCount = useMemo(
    () => Object.keys(walletBalance?.balances ?? {}).length,
    [walletBalance],
  );

  const walletReadinessLabel = useMemo(() => {
    if (!walletStatus) return "Not loaded";
    if (!walletStatus.active) return "Inactive";
    if (!walletStatus.funded) return "Funding required";
    if (!walletStatus.trustline_ready) return "Trustline missing";
    return walletStatus.usable ? "Ready" : "Review required";
  }, [walletStatus]);

  const walletReadinessTone = useMemo(() => {
    if (!walletStatus) return "text-slate-900";
    return walletStatus.usable ? "text-emerald-600" : "text-amber-600";
  }, [walletStatus]);

  const walletAddress = wallet?.public_key ?? walletStatus?.public_key ?? walletForm.public_key;

  function handleCreateWallet() {
    if (!activeUserId) {
      toast("Provide a user ID or log in before creating a wallet.", "error");
      return;
    }
    createWalletMutation.mutate(
      { user_id: activeUserId },
      {
        onSuccess: (data) => {
          setWalletForm((current) => ({
            ...current,
            user_id: data.user_id,
            public_key: data.public_key,
            funded: data.funded,
            trustline_ready: data.trustline_ready,
          }));
        },
      },
    );
  }

  function handleLinkWallet() {
    if (!walletForm.user_id.trim() || !walletForm.public_key.trim()) {
      toast("Provide both a user ID and public key before linking a wallet.", "error");
      return;
    }
    linkWalletMutation.mutate({
      user_id: walletForm.user_id.trim(),
      public_key: walletForm.public_key.trim(),
      funded: walletForm.funded,
      trustline_ready: walletForm.trustline_ready,
    });
  }

  function handleLoadWalletDetails() {
    if (!activeUserId) {
      toast("Provide a user ID or log in before loading wallet details.", "error");
      return;
    }
    setRequestedUserId(activeUserId);
    toast("Wallet details loaded.", "success");
  }

  function handleLoadBalance() {
    const address = wallet?.public_key ?? walletForm.public_key.trim();
    if (!address) {
      toast("Load or link a wallet before requesting balances.", "error");
      return;
    }
    setRequestedAddressState(address);
    toast("Wallet balance loaded.", "success");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Settings and Wallet Control
        </h1>
        <p className="text-sm text-slate-500">
          Manage operator session state, register or sign in, and check wallet readiness from the live backend.
        </p>
      </div>

      <AccountProfileCard />
      <SessionManagementCard />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Session</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {currentUser ? "Authenticated" : "Not signed in"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {currentUser?.email ?? "Load or create an operator account"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Wallet</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {walletAddress ? "Connected" : "Not linked"}
          </p>
          <p className="mt-1 truncate text-sm text-slate-500">
            {walletAddress || "Create or link a wallet to continue"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Readiness</p>
          <p className={`mt-2 text-xl font-semibold ${walletReadinessTone}`}>
            {walletReadinessLabel}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {walletStatus
              ? `${walletStatus.funded ? "Funded" : "Unfunded"} • ${
                  walletStatus.trustline_ready ? "Trustline ready" : "Trustline missing"
                }`
              : "Load wallet details to inspect readiness"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Balances</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{walletAssetCount}</p>
          <p className="mt-1 text-sm text-slate-500">
            {walletAssetCount > 0 ? "Tracked assets loaded" : "No balance data loaded yet"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AccountSessionFormCard
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          session={session}
          setSession={setSession}
          onUserSelected={(userId) => setWalletForm((current) => ({ ...current, user_id: userId }))}
        />

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Wallet Status</h2>
              <p className="text-sm text-slate-500">
                Create, link, and inspect the operator wallet through the backend bridge.
              </p>
            </div>
            <WalletHealthBadge status={walletStatus} />
          </div>

          <div className="grid gap-3">
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={walletForm.user_id}
              onChange={(event) => setWalletForm((current) => ({ ...current, user_id: event.target.value }))}
              placeholder="User ID"
            />
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={walletForm.public_key}
              onChange={(event) => setWalletForm((current) => ({ ...current, public_key: event.target.value }))}
              placeholder="Public key"
            />
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={walletForm.funded}
                  onChange={(event) => setWalletForm((current) => ({ ...current, funded: event.target.checked }))}
                />
                Funded
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={walletForm.trustline_ready}
                  onChange={(event) => setWalletForm((current) => ({ ...current, trustline_ready: event.target.checked }))}
                />
                Trustline ready
              </label>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={handleCreateWallet}
              disabled={createWalletMutation.isPending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {createWalletMutation.isPending ? "Creating..." : "Create wallet"}
            </button>
            <button
              onClick={handleLinkWallet}
              disabled={linkWalletMutation.isPending}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {linkWalletMutation.isPending ? "Linking..." : "Link wallet"}
            </button>
            <button
              onClick={handleLoadWalletDetails}
              disabled={walletQuery.isFetching || walletStatusQuery.isFetching}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {walletQuery.isFetching || walletStatusQuery.isFetching ? "Loading..." : "Load wallet details"}
            </button>
            <button
              onClick={handleLoadBalance}
              disabled={walletBalanceQuery.isFetching}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {walletBalanceQuery.isFetching ? "Loading..." : "Load balance"}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <h3 className="font-medium text-slate-900">Wallet details</h3>
              {wallet ? (
                <dl className="mt-3 grid gap-2 text-slate-600">
                  <div className="flex justify-between gap-4">
                    <dt>Address</dt>
                    <dd className="text-right">
                      <WalletAddress address={wallet.public_key} />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Funded</dt>
                    <dd className="font-medium text-slate-900">{wallet.funded ? "Yes" : "No"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Trustline</dt>
                    <dd className="font-medium text-slate-900">{wallet.trustline_ready ? "Ready" : "Missing"}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-slate-500">No wallet loaded yet.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <h3 className="font-medium text-slate-900">Wallet readiness</h3>
              {walletStatus ? (
                <dl className="mt-3 grid gap-2 text-slate-600">
                  <div className="flex justify-between gap-4">
                    <dt>Active</dt>
                    <dd className="font-medium text-slate-900">{walletStatus.active ? "Yes" : "No"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Usable</dt>
                    <dd className="font-medium text-slate-900">{walletStatus.usable ? "Ready" : "Not ready"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Last updated</dt>
                    <dd className="font-medium text-slate-900">{new Date(walletStatus.last_updated).toLocaleString()}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-slate-500">Load wallet details to inspect readiness.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <h3 className="font-medium text-slate-900">Balances</h3>
            {walletBalance ? (
              <div className="mt-3 grid gap-2">
                {Object.entries(walletBalance.balances).map(([asset, balance]) => (
                  <div
                    key={asset}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                  >
                    <span className="font-medium text-slate-900">{asset}</span>
                    <span className="text-slate-600">{balance.balance}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-slate-500">No balance data loaded yet.</p>
            )}
          </div>
        </section>
      </div>

      <WalletReadinessCard walletStatus={walletStatus} />
    </div>
  );
}
