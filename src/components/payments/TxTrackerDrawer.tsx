import React, { useState, useEffect } from 'react';

export type TxStage = 'BUILT' | 'SIMULATING' | 'SIGNING' | 'SUBMITTING' | 'CONFIRMED' | 'FAILED';

interface TxTrackerDrawerProps {
    isOpen: boolean;
    txHash?: string;
    currentStage: TxStage;
    errorMessage?: string;
    network?: string;
    onClose: () => void;
}

export const TxTrackerDrawer: React.FC<TxTrackerDrawerProps> = ({
    isOpen,
    txHash,
    currentStage,
    errorMessage,
    network = 'TESTNET',
    onClose,
}) => {
    if (!isOpen) return null;

    const stages: { key: TxStage; label: string }[] = [
        { key: 'BUILT', label: 'Envelope Built' },
        { key: 'SIMULATING', label: 'Simulating' },
        { key: 'SIGNING', label: 'Wallet Signing' },
        { key: 'SUBMITTING', label: 'Ledger Submission' },
        { key: 'CONFIRMED', label: 'Confirmed' },
    ];

    const stageOrder: TxStage[] = ['BUILT', 'SIMULATING', 'SIGNING', 'SUBMITTING', 'CONFIRMED'];
    const currentIdx = stageOrder.indexOf(currentStage);
    const isFailed = currentStage === 'FAILED';

    const explorerUrl = txHash 
        ? `https://stellar.expert/explorer/${network.toLowerCase()}/tx/${txHash}`
        : '#';

    const truncateHash = (hash: string) => `${hash.slice(0, 8)}...${hash.slice(-8)}`;

    return (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-800 p-6 shadow-2xl flex flex-col justify-between text-slate-100 animate-slide-left backdrop-blur-xl">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <div className="flex items-center space-x-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-ping" />
                    <h3 className="text-base font-semibold text-slate-200">Transaction Status Tracker</h3>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-200 text-sm p-1 transition-colors"
                    aria-label="Close drawer"
                >
                    ✕
                </button>
            </div>

            {/* Timeline Steps */}
            <div className="space-y-4 mb-6">
                {stages.map((stage, idx) => {
                    const isCompleted = !isFailed && currentIdx > idx;
                    const isCurrent = !isFailed && currentStage === stage.key;

                    return (
                        <div key={stage.key} className="flex items-start space-x-3">
                            <div className="flex flex-col items-center">
                                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold border ${
                                    isCompleted 
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                                        : isCurrent 
                                        ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40 animate-pulse' 
                                        : isFailed && idx === currentIdx
                                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                        : 'bg-slate-800 text-slate-500 border-slate-700'
                                }`}>
                                    {isCompleted ? '✓' : idx + 1}
                                </div>
                                {idx < stages.length - 1 && (
                                    <div className={`w-0.5 h-8 my-1 ${isCompleted ? 'bg-emerald-500/40' : 'bg-slate-800'}`} />
                                )}
                            </div>
                            <div className="pt-1">
                                <h4 className={`text-sm font-medium ${isCurrent ? 'text-indigo-400' : isCompleted ? 'text-slate-200' : 'text-slate-500'}`}>
                                    {stage.label}
                                </h4>
                                {isCurrent && (
                                    <p className="text-xs text-slate-400 mt-0.5">Processing ledger verification...</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {isFailed && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-xs text-red-400 mb-6">
                    <span className="font-semibold block mb-1">Transaction Execution Failed</span>
                    {errorMessage || 'An error occurred during on-chain submission.'}
                </div>
            )}

            {txHash && (
                <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-4 mb-6">
                    <span className="text-xs text-slate-400 block mb-1">Transaction Hash</span>
                    <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-indigo-400 hover:underline flex items-center space-x-1"
                    >
                        <span>{truncateHash(txHash)}</span>
                        <span>↗</span>
                    </a>
                </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800">
              <button
                  onClick={onClose}
                  className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-medium text-slate-200 transition-colors"
              >
                  {currentStage === 'CONFIRMED' || isFailed ? 'Close Tracker' : 'Minimize Drawer'}
              </button>
          </div>
        </div>
    );
};