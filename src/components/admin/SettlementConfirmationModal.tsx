import React, { useState } from 'react';

interface SettlementConfirmationModalProps {
    isOpen: boolean;
    disputeId: string;
    targetClaimant: string;
    penaltyAmount: number;
    onClose: () => void;
    onConfirmSettlement: () => void;
}

export const SettlementConfirmationModal: React.FC<SettlementConfirmationModalProps> = ({
    isOpen,
    disputeId,
    targetClaimant,
    penaltyAmount,
    onClose,
    onConfirmSettlement,
}) => {
    const [confirmationInput, setConfirmationInput] = useState('');
    const requiredPhrase = 'SETTLE';
    const isVerified = confirmationInput === requiredPhrase;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
                <div className="flex items-center space-x-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                        ⚡
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Confirm Dispute Resolution</h3>
                        <p className="text-xs text-slate-400 font-mono">Dispute ID: {disputeId}</p>
                    </div>
                </div>

                <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                    Settling this dispute executes immutable metric adjustments and penalty enforcement on-chain. This action cannot be undone.
                </p>

                <div className="space-y-3 mb-6 bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 text-xs">
                    <div className="flex justify-between">
                        <span className="text-slate-400">Target Claimant:</span>
                        <span className="font-mono text-slate-200">{targetClaimant.slice(0, 6)}...{targetClaimant.slice(-4)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Enforced Penalty:</span>
                        <span className="font-mono text-red-400 font-semibold">{penaltyAmount.toLocaleString()} XLM</span>
                    </div>
                </div>

                <div className="mb-6 space-y-2">
                    <label className="block text-xs font-medium text-slate-300">
                        Type <span className="font-mono text-red-400 font-bold">{requiredPhrase}</span> to confirm resolution:
                    </label>
                    <input
                        type="text"
                        value={confirmationInput}
                        onChange={(e) => setConfirmationInput(e.target.value)}
                        placeholder="Type SETTLE here"
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none font-mono"
                        autoFocus
                    />
                </div>

                <div className="flex space-x-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-lg bg-slate-800 hover:bg-slate-700 py-2.5 text-sm font-medium transition-colors text-slate-300"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            if (isVerified) {
                                onConfirmSettlement();
                                onClose();
                            }
                        }}
                        disabled={!isVerified}
                        className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                            isVerified
                                ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        Execute Settlement
                    </button>
                </div>
            </div>
        </div>
    );
};