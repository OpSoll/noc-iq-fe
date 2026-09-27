// src/components/wallet/AssetInspector.tsx
import React, { useState } from 'react';

interface TokenBalance {
    contractId: string;
    symbol: string;
    name: string;
    balance: string;
    usdValue: string;
    iconUrl?: string;
}

interface AssetInspectorProps {
    nativeXlmBalance: string;
    nativeXlmUsd: string;
    tokens: TokenBalance[];
    onAddToken: (contractId: string) => void;
}

export const AssetInspector: React.FC<AssetInspectorProps> = ({
    nativeXlmBalance,
    nativeXlmUsd,
    tokens,
    onAddToken,
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [customContractId, setCustomContractId] = useState('');

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!customContractId.trim()) return;
        onAddToken(customContractId.trim());
        setCustomContractId('');
        setIsModalOpen(false);
    };

    const truncateId = (id: string) => `${id.slice(0, 4)}...${id.slice(-4)}`;

    return (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 max-w-md w-full">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <div className="flex items-center space-x-2">
                    <span className="text-xl">💼</span>
                    <h3 className="text-base font-semibold text-slate-200">Asset Balances</h3>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-400 transition-colors cursor-pointer"
                >
                    + Add Token
                </button>
            </div>

            <div className="space-y-3 mb-6">
                {/* Native XLM Asset */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
                    <div className="flex items-center space-x-3">
                        <div className="h-9 w-9 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 text-xs">
                            XLM
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-slate-200">Stellar Lumens</h4>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Native Asset</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="font-mono text-sm font-semibold text-slate-100">{nativeXlmBalance} XLM</div>
                        <div className="font-mono text-xs text-slate-400">${nativeXlmUsd} USD</div>
                    </div>
                </div>

                {/* Custom SAC Tokens */}
                {tokens.map((token) => (
                    <div key={token.contractId} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
                        <div className="flex items-center space-x-3">
                            <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-xs">
                                {token.symbol.slice(0, 3)}
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-slate-200">{token.name}</h4>
                                <span className="font-mono text-[10px] text-slate-400">{truncateId(token.contractId)}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-mono text-sm font-semibold text-slate-100">{token.balance} {token.symbol}</div>
                            <div className="font-mono text-xs text-slate-400">${token.usdValue} USD</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Custom Token Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-fade-in">
                    <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
                        <h3 className="text-base font-semibold text-slate-200 mb-2">Add Custom SAC Token</h3>
                        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                            Enter the Stellar Asset Contract (SAC) ID to track custom balances in your wallet.
                        </p>
                        <form onSubmit={handleAddSubmit} className="space-y-4">
                            <input
                                type="text"
                                placeholder="C... (Contract ID)"
                                value={customContractId}
                                onChange={(e) => setCustomContractId(e.target.value)}
                                className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                            <div className="flex space-x-3">
                                <button
                                    type="submit"
                                    className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-medium text-white transition-colors cursor-pointer"
                                >
                                    Track Token
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-medium text-slate-300 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};