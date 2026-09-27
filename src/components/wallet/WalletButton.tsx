'use client';

import React, { useState, useEffect } from 'react';
import { getAddress, isConnected, requestAccess } from '@stellar/freighter-api';

import QrCodeModal from '@/components/wallet/QrCodeModal';
import { useToast } from '@/components/ui/toast';
import { useWalletStore } from '@/store/walletStore';

interface WalletButtonProps {
  network?: string;
  onConnect?: (publicKey: string) => void;
  onDisconnect?: () => void;
  /** Network id used to build the `stellar:` URI inside the QR modal. */
  qrNetwork?: 'mainnet' | 'testnet';
}

export const WalletButton: React.FC<WalletButtonProps> = ({
  network = 'TESTNET',
  onConnect,
  onDisconnect,
  qrNetwork = 'testnet',
}) => {
  const toast = useToast();

  // Connection state lives in the store, so a disconnect genuinely resets the
  // app-wide wallet context rather than just this component's local state.
  // (Closes #657)
  const storePublicKey = useWalletStore((state) => state.publicKey);
  const connect = useWalletStore((state) => state.connect);
  const disconnect = useWalletStore((state) => state.disconnect);

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [hasFreighter, setHasFreighter] = useState<boolean>(true);
  const [isQrOpen, setIsQrOpen] = useState<boolean>(false);

  // Reflect store changes (e.g. a disconnect triggered elsewhere) locally.
  useEffect(() => {
    if (storePublicKey === null) setPublicKey(null);
  }, [storePublicKey]);

  // Auto-connect check on mount if previously authorized
  useEffect(() => {
    const checkAutoConnect = async () => {
      try {
        const connected = await isConnected();
        if (connected.isConnected) {
          const { address } = await getAddress();
          if (address) {
            setPublicKey(address);
            connect({ publicKey: address, network });
            if (onConnect) onConnect(address);
          }
        }
      } catch (error) {
        console.error('Failed to auto-connect to Freighter wallet:', error);
      }
    };

    checkAutoConnect();
  }, [connect, network, onConnect]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const connected = await isConnected();
      if (!connected.isConnected) {
        setHasFreighter(false);
        return;
      }

      const { address } = await requestAccess();
      if (address) {
        setPublicKey(address);
        connect({ publicKey: address, network });
        if (onConnect) onConnect(address);
      }
    } catch (error) {
      console.error('Freighter wallet connection error:', error);
      setHasFreighter(false);
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Disconnecting clears the store *and* every wallet key we put in
   * `sessionStorage`, so no keypair reference survives in the page.
   * (Closes #657)
   */
  const handleDisconnect = () => {
    disconnect();
    setPublicKey(null);
    setIsQrOpen(false);
    toast('Wallet disconnected', 'success');
    onDisconnect?.();
  };

  const truncateKey = (key: string) => `${key.slice(0, 4)}...${key.slice(-4)}`;

  return (
    <div className="flex items-center space-x-3">
      {!hasFreighter ? (
        <a
          href="https://www.freighter.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          Install Freighter
        </a>
      ) : publicKey ? (
        <div className="flex items-center space-x-2 rounded-xl bg-slate-900 border border-slate-800 p-1.5 pl-3 shadow-lg">
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs text-slate-200 font-medium">
              {truncateKey(publicKey)}
            </span>
          </div>
          <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-[10px] font-mono text-indigo-400 uppercase border border-slate-700/50">
            {network}
          </span>
          {/* Share the key with a mobile wallet as a QR code. (Closes #658) */}
          <button
            type="button"
            onClick={() => setIsQrOpen(true)}
            aria-label="Show public key QR code"
            data-testid="wallet-qr-button"
            className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            QR
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            aria-label="Disconnect wallet"
            data-testid="wallet-disconnect-button"
            className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-red-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-medium text-white transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
        >
          {isConnecting ? 'Connecting...' : 'Connect Freighter'}
        </button>
      )}

      <QrCodeModal
        isOpen={isQrOpen}
        publicKey={publicKey ?? ''}
        network={qrNetwork}
        onClose={() => setIsQrOpen(false)}
      />
    </div>
  );
};
