'use client';

import {
  detectNetworkMismatch,
  getNetworkLabel,
  type NetworkMismatch,
  type StellarNetworkId,
} from '@/lib/stellarNetworks';

/**
 * Warns when the browser wallet and the console are pointed at different
 * Stellar networks.
 *
 * Transactions signed with the wrong network passphrase are rejected by the
 * network with a generic `tx_bad_auth`, so surfacing the mismatch before the
 * user signs anything turns an opaque failure into a one-click fix.
 *
 * Closes #656 — active network passphrase mismatch detection alert.
 */

export interface NetworkMismatchAlertProps {
  /** Network passphrase reported by the connected browser wallet. */
  walletPassphrase: string | null;
  /** Network passphrase the console is currently configured for. */
  consolePassphrase: string | null;
  /** Quick action that points the console at the wallet's network. */
  onSwitchConsoleNetwork?: (network: StellarNetworkId) => void;
  className?: string;
}

export default function NetworkMismatchAlert({
  walletPassphrase,
  consolePassphrase,
  onSwitchConsoleNetwork,
  className,
}: NetworkMismatchAlertProps) {
  const mismatch: NetworkMismatch | null = detectNetworkMismatch(
    walletPassphrase,
    consolePassphrase
  );

  if (!mismatch) return null;

  const walletLabel = mismatch.walletNetwork
    ? getNetworkLabel(mismatch.walletNetwork.id)
    : 'unknown network';
  const consoleLabel = mismatch.consoleNetwork
    ? getNetworkLabel(mismatch.consoleNetwork.id)
    : 'unknown network';

  return (
    <div
      role="alert"
      data-testid="network-mismatch-alert"
      className={[
        'flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4',
        'text-amber-900 sm:flex-row sm:items-start sm:justify-between',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 font-bold text-amber-900"
        >
          !
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold">Network mismatch detected</p>
          <p className="text-sm">
            Your wallet is connected to{' '}
            <strong className="font-semibold">{walletLabel}</strong> but this
            console is configured for{' '}
            <strong className="font-semibold">{consoleLabel}</strong>.
            Transactions signed on one network are rejected by the other.
          </p>
          <details className="text-xs">
            <summary className="cursor-pointer font-medium">
              Show network passphrases
            </summary>
            <dl className="mt-2 space-y-1 font-mono">
              <div>
                <dt className="inline font-semibold">Wallet: </dt>
                <dd className="inline">{mismatch.walletPassphrase}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Console: </dt>
                <dd className="inline">{mismatch.consolePassphrase}</dd>
              </div>
            </dl>
          </details>
        </div>
      </div>

      {onSwitchConsoleNetwork && mismatch.walletNetwork && (
        <button
          type="button"
          onClick={() => onSwitchConsoleNetwork(mismatch.walletNetwork!.id)}
          className="shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          Switch Console Network
        </button>
      )}
    </div>
  );
}
