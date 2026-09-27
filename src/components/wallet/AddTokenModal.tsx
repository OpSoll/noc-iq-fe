'use client';

import { useCallback, useEffect, useId, useState } from 'react';

import Modal from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import {
  formatContractBalance,
  parseAssetMetadata,
  validateContractId,
} from '@/lib/contractTokens';
import {
  getContractAssetInfo,
  getContractBalance,
} from '@/services/contractService';
import { useWalletStore, type TrackedToken } from '@/store/walletStore';

/**
 * Lets a developer track a custom Soroban token contract that does not appear
 * in the automatic wallet asset list.
 *
 * The modal validates the contract ID locally, resolves the token's symbol and
 * decimals through the API, reads the connected account's balance, and stores
 * the result in the workspace store so it survives navigation and reloads.
 *
 * Closes #659 — custom SAC token contract address tracker modal.
 */

export interface AddTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Public key whose balance should be tracked. Defaults to the connected wallet. */
  ownerPublicKey?: string | null;
  /** Pre-fills the contract ID, e.g. from a "Track this contract" action. */
  initialContractId?: string;
}

type LookupState = 'idle' | 'loading' | 'error';

export default function AddTokenModal({
  isOpen,
  onClose,
  ownerPublicKey,
  initialContractId = '',
}: AddTokenModalProps) {
  const toast = useToast();
  const inputId = useId();
  const connectedPublicKey = useWalletStore((state) => state.publicKey);
  const addTrackedToken = useWalletStore((state) => state.addTrackedToken);

  const owner = ownerPublicKey ?? connectedPublicKey;

  const [contractId, setContractId] = useState(initialContractId);
  const [touched, setTouched] = useState(false);
  const [lookupState, setLookupState] = useState<LookupState>('idle');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TrackedToken | null>(null);

  // Reset when the modal is (re)opened so a previous attempt never leaks in.
  useEffect(() => {
    if (isOpen) {
      setContractId(initialContractId);
      setTouched(false);
      setLookupState('idle');
      setLookupError(null);
      setPreview(null);
    }
  }, [isOpen, initialContractId]);

  const contractIdError = validateContractId(contractId);
  const isValid = contractIdError === null;

  const handleLookup = useCallback(async () => {
    setTouched(true);
    if (contractIdError) return;
    if (!owner) {
      setLookupError('Connect a wallet before tracking a token balance.');
      setLookupState('error');
      return;
    }

    setLookupState('loading');
    setLookupError(null);
    setPreview(null);

    try {
      const trimmed = contractId.trim();
      const [info, balance] = await Promise.all([
        getContractAssetInfo(trimmed),
        getContractBalance(trimmed, owner),
      ]);

      const metadata = parseAssetMetadata(info);
      setPreview({
        contractId: trimmed,
        symbol: metadata.symbol,
        decimals: metadata.decimals,
        issuer: metadata.issuer,
        balance,
        addedAt: new Date().toISOString(),
      });
      setLookupState('idle');
    } catch (err) {
      setLookupState('error');
      setLookupError(
        err instanceof Error
          ? err.message
          : 'Could not query this contract. Verify the ID and try again.'
      );
    }
  }, [contractId, contractIdError, owner]);

  const handleTrack = useCallback(() => {
    if (!preview) return;
    addTrackedToken(preview);
    toast(`${preview.symbol} added to tracked tokens`, 'success');
    onClose();
  }, [preview, addTrackedToken, toast, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Track a custom token contract"
      maxWidth="max-w-lg"
      disableBackdropClose
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Custom Soroban tokens deployed on testnet do not show up in the
          automatic wallet asset list. Add the contract ID to track its balance
          here.
        </p>

        <div className="space-y-1">
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700"
          >
            Contract ID
          </label>
          <input
            id={inputId}
            value={contractId}
            onChange={(e) => {
              setContractId(e.target.value);
              setPreview(null);
              setLookupState('idle');
              setLookupError(null);
            }}
            onBlur={() => setTouched(true)}
            placeholder="C…"
            aria-invalid={touched && contractIdError !== null}
            aria-describedby={
              touched && contractIdError ? `${inputId}-error` : undefined
            }
            data-testid="contract-id-input"
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
          {touched && contractIdError && (
            <p
              id={`${inputId}-error`}
              role="alert"
              className="text-xs text-red-700"
            >
              {contractIdError}
            </p>
          )}
        </div>

        {!owner && (
          <p role="status" className="text-xs text-amber-700">
            No connected wallet — connect one to read this contract&apos;s
            balance.
          </p>
        )}

        {lookupError && (
          <p role="alert" className="text-sm text-red-700">
            {lookupError}
          </p>
        )}

        {preview && (
          <div
            data-testid="token-preview"
            className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
          >
            <p className="font-semibold text-slate-800">{preview.symbol}</p>
            <p className="text-slate-600">
              Balance:{' '}
              <span className="font-mono" data-testid="token-balance">
                {formatContractBalance(preview.balance, preview.decimals) ??
                  '0'}
              </span>{' '}
              {preview.symbol} (raw {preview.balance}, {preview.decimals}{' '}
              decimals)
            </p>
            <p className="break-all font-mono text-xs text-slate-400">
              {preview.contractId}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Cancel
          </button>
          {!preview ? (
            <button
              type="button"
              onClick={handleLookup}
              disabled={lookupState === 'loading' || !contractId.trim()}
              data-testid="lookup-button"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {lookupState === 'loading' ? 'Querying…' : 'Look up token'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleTrack}
              data-testid="track-button"
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Track this token
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
