"use client";

type WalletStatus = {
  active: boolean;
  funded: boolean;
  trustline_ready: boolean;
  usable: boolean;
  public_key: string;
} | null;

export function WalletReadinessCard({ walletStatus }: { walletStatus: WalletStatus }) {
  if (!walletStatus) return null;

  return (
    <>
      {!walletStatus.usable && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-amber-900">Wallet Not Ready — Next Steps</h2>
          <p className="mt-1 text-sm text-amber-700">
            Your wallet must be funded and have a trustline set up before payments can be processed.
          </p>
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
                <span><strong>Fund your wallet.</strong> Send at least 1 XLM to <code className="rounded bg-amber-100 px-1 font-mono text-xs">{walletStatus.public_key}</code> on the Stellar network to activate the account.</span>
              </li>
            )}
            {walletStatus.active && walletStatus.funded && !walletStatus.trustline_ready && (
              <li className="flex items-start gap-3 text-sm text-amber-800">
                <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-amber-200 text-center text-xs font-bold leading-5 text-amber-900">3</span>
                <span><strong>Set up a trustline.</strong> Your wallet is funded but missing a trustline for the payment asset. Use the Stellar Laboratory or your wallet app to add a trustline for the required asset.</span>
              </li>
            )}
          </ul>
        </section>
      )}

      {walletStatus.usable && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-emerald-800">
            ✓ Wallet is fully ready — funded, trustline active, and usable for payments.
          </p>
        </section>
      )}
    </>
  );
}
