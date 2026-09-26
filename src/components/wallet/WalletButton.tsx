import React, { useState, useEffect } from 'react';
import { isConnected, getPublicKey, requestAccess } from '@stellar/freighter-api';

interface WalletButtonProps {
    network?: string;
    onConnect?: (publicKey: string) => void;
}

export const WalletButton: React.FC<WalletButtonProps> = ({
    network = 'TESTNET',
    onConnect,
}) => {
    const [publicKey, setPublicKey] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState<boolean>(false);
    const [hasFreighter, setHasFreighter] = useState<boolean>(true);

    // Auto-connect check on mount if previously authorized
    useEffect(() => {
        const checkAutoConnect = async () => {
            try {
                const connected = await isConnected();
                if (connected) {
                    const key = await getPublicKey();
                    if (key) {
                        setPublicKey(key);
                        if (onConnect) onConnect(key);
                    }
                }
            } catch (error) {
                console.error('Failed to auto-connect to Freighter wallet:', error);
            }
        };

        checkAutoConnect();
    }, [onConnect]);

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            const key = await getPublicKey();
            if (key) {
                setPublicKey(key);
                if (onConnect) onConnect(key);
            } else {
                // Request access if not yet granted
                const access = await requestAccess();
                if (access) {
                    const newKey = await getPublicKey();
                    if (newKey) {
                        setPublicKey(newKey);
                        if (onConnect) onConnect(newKey);
                    }
                }
            }
        } catch (error) {
            console.error('Freighter wallet connection error:', error);
            setHasFreighter(false);
        } finally {
            setIsConnecting(false);
        }
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
        </div>
    );
};