'use client';

import { useCallback, useId, useMemo, useState } from 'react';

import Modal from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import {
  encodeQr,
  getQuietZoneModules,
  qrToPath,
  QrCapacityError,
} from '@/lib/qrcode';

/**
 * Renders a Stellar public key as a scannable QR code so it can be moved to a
 * mobile wallet without copy/pasting a 56-character string.
 *
 * The QR is generated client-side with a local ISO/IEC 18004 encoder — no
 * third-party encoder is pulled into the bundle, and the key never leaves the
 * browser.
 *
 * Closes #658 — QR code modal for public key sharing.
 */

const STELLAR_URI_PREFIX = 'stellar:';
const MIN_MODULE_SIZE = 3;
const MAX_MODULE_SIZE = 8;

export interface QrCodeModalProps {
  isOpen: boolean;
  publicKey: string;
  /** Stellar network id appended to the `stellar:` URI. Defaults to testnet. */
  network?: 'mainnet' | 'testnet';
  onClose: () => void;
}

function buildStellarUri(publicKey: string, network: 'mainnet' | 'testnet') {
  return `${STELLAR_URI_PREFIX}${publicKey}?network=${network}`;
}

export default function QrCodeModal({
  isOpen,
  publicKey,
  network = 'testnet',
  onClose,
}: QrCodeModalProps) {
  const toast = useToast();
  const inputId = useId();
  const [moduleSize, setModuleSize] = useState(4);

  const trimmedKey = publicKey.trim();

  // Encoding a malformed or oversized key must not take the modal down with
  // it, so failures degrade to a readable message.
  const { qr, error } = useMemo(() => {
    if (!trimmedKey) {
      return { qr: null, error: 'No public key available to share.' };
    }
    try {
      const payload = buildStellarUri(
        trimmedKey,
        network === 'mainnet' ? 'mainnet' : 'testnet'
      );
      return { qr: encodeQr(payload), error: null as string | null };
    } catch (err) {
      return {
        qr: null,
        error:
          err instanceof QrCapacityError
            ? err.message
            : 'Could not generate a QR code for this public key.',
      };
    }
  }, [trimmedKey, network]);

  const handleCopy = useCallback(async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(trimmedKey);
      } else {
        throw new Error('Clipboard API unavailable');
      }
      toast('Public key copied to clipboard', 'success');
    } catch {
      toast('Could not copy the public key', 'error');
    }
  }, [trimmedKey, toast]);

  const handleDownload = useCallback(() => {
    if (!qr) return;
    const quietZone = getQuietZoneModules();
    const dimension = (qr.size + quietZone * 2) * moduleSize;
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}"`,
      ` viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges">`,
      `<rect width="${dimension}" height="${dimension}" fill="#ffffff"/>`,
      `<path d="${qrToPath(qr, { quietZone })}" fill="#0f172a"/>`,
      '</svg>',
    ].join('');

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `public-key-${trimmedKey.slice(0, 6)}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast('QR code downloaded', 'success');
  }, [qr, moduleSize, trimmedKey, toast]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share public key"
      maxWidth="max-w-md"
    >
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center rounded-lg border border-slate-200 bg-white p-4">
            <svg
              role="img"
              aria-label={`QR code for public key ${trimmedKey}`}
              data-testid="qr-code-svg"
              width={(qr!.size + getQuietZoneModules() * 2) * moduleSize}
              height={(qr!.size + getQuietZoneModules() * 2) * moduleSize}
              viewBox={`0 0 ${(qr!.size + getQuietZoneModules() * 2) * moduleSize} ${
                (qr!.size + getQuietZoneModules() * 2) * moduleSize
              }`}
              shapeRendering="crispEdges"
            >
              <title>Public key QR code</title>
              <rect
                width="100%"
                height="100%"
                fill="#ffffff"
                data-testid="qr-quiet-zone"
              />
              <path
                d={qrToPath(qr!, { quietZone: getQuietZoneModules() })}
                fill="#0f172a"
                data-testid="qr-modules"
              />
            </svg>
          </div>

          <div className="space-y-1">
            <label
              htmlFor={inputId}
              className="block text-xs font-medium text-slate-600"
            >
              Public key
            </label>
            <input
              id={inputId}
              readOnly
              value={trimmedKey}
              data-testid="public-key-value"
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-800"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <label htmlFor={`${inputId}-size`}>Size</label>
            <input
              id={`${inputId}-size`}
              type="range"
              min={MIN_MODULE_SIZE}
              max={MAX_MODULE_SIZE}
              step={1}
              value={moduleSize}
              onChange={(e) => setModuleSize(Number(e.target.value))}
              className="flex-1"
            />
            <span className="font-mono">{moduleSize}px</span>
          </div>

          <p className="text-xs text-slate-400">
            Scannable by any wallet on{' '}
            {network === 'mainnet' ? 'Mainnet' : 'Testnet'}.
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Copy public key
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Download QR image
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
