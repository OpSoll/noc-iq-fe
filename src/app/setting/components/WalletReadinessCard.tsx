"use client";

import { explorerLink, STELLAR_NETWORK_LABEL } from "@/lib/explorer";
import { ExternalLink, RefreshCcw } from "lucide-react";

type WalletStatus = {
  active: boolean;
  funded: boolean;
  trustline_ready: boolean;
  usable: boolean;
  public_key: string;
} | null;

interface WalletReadinessCardProps {
  walletStatus: WalletStatus;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdated?: string | null;
}

export function WalletReadinessCard({
  walletStatus,
  onRefresh,
  isRefreshing = false,
  lastUpdated,
}: WalletReadinessCardProps) {
  if (!walletStatus) return null;

  const explorerHref = explorerLink("account", walletStatus.public_key);

  return (
    <>
      {!walletStatus.usable && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-amber-900">Wallet Not Ready — Next Steps</h2>
              <p className="mt-1 text-sm text-amber-700">
                Your wallet must be funded and have a trustline set up before payments can be processed.
              </p>
            </div>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                title="Recheck wallet status on the backend"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                {isRefreshing ? "Checking…" : "Recheck"}
              </button>
            )}
          </div>
          <ul className="mt-4 space-y-3">
            {!walletStatus.active && (
              <li className="flex items-start gap-3 text-sm text-amber-800">
                <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-amber-200 text-center text-xs font-bold leading-5 text-amber-900">1</span>
                <span><strong>Activate your wallet.</strong> The wallet is currently inactive. Contact your administrator or re-link the wallet via the Wallet Status panel above.</span>
              </li>
            )}
            {walletStatus.active && !walletStatus.funded && (
              <li className="flex items-start gap-3 text-sm text-amber-800">
                <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-amber-200 text-center text-xs font-bold leading-5 text-amber-900">2</span>
                <span>
                  <strong>Fund your wallet.</strong> Send at least 1 XLM to{" "}
                  <code className="rounded bg-amber-100 px-1 font-mono text-xs">{walletStatus.public_key}</code>{" "}
                  on the <strong>{STELLAR_NETWORK_LABEL}</strong> Stellar network to activate the account.
                  {explorerHref && (
                    <>
                      {" "}
                      <a
                        href={explorerHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-blue-700 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View on explorer <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  )}
                </span>
              </li>
            )}
            {walletStatus.active && walletStatus.funded && !walletStatus.trustline_ready && (
              <li className="flex items-start gap-3 text-sm text-amber-800">
                <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-amber-200 text-center text-xs font-bold leading-5 text-amber-900">3</span>
                <span><strong>Set up a trustline.</strong> Your wallet is funded but missing a trustline for the payment asset. Use the Stellar Laboratory or your wallet app to add a trustline for the required asset.</span>
              </li>
            )}
          </ul>
          {lastUpdated && (
            <p className="mt-4 text-xs text-amber-600">
              Status last checked: {new Date(lastUpdated).toLocaleString()}
            </p>
          )}
        </section>
      )}

      {walletStatus.usable && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-emerald-800">
              ✓ Wallet is fully ready — funded, trustline active, and usable for payments.
            </p>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                title="Recheck wallet status"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Checking…" : "Recheck"}
              </button>
            )}
          </div>
          {lastUpdated && (
            <p className="mt-2 text-xs text-emerald-600">
              Status last checked: {new Date(lastUpdated).toLocaleString()}
            </p>
          )}
        </section>
      )}
    </>
  );
}