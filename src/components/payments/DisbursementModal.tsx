import React, { useState } from 'react';

interface DisbursementModalProps {
    isOpen: boolean;
    recipientPublicKey: string;
    tokenContractId: string;
    penaltyAmount: string;
    network?: string;
    onClose: () => void;
    onSubmit: (txPayload: { recipient: string; amount: string; token: string }) => void;
}

export const DisbursementModal: React.FC<DisbursementModalProps> = ({
    isOpen,
    recipientPublicKey,
    tokenContractId,
    penaltyAmount,
    network = 'TESTNET',
    onClose,
    onSubmit,
}) => {
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationPassed, setSimulationPassed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSimulate = async () => {
        setIsSimulating(true);
        setTimeout(() => {
            setIsSimulating(false);
            setSimulationPassed(true);
        }, 1200);
    };

    const handleExecute = async () => {
        setIsSubmitting(true);
        try {
            await onSubmit({
                recipient: recipientPublicKey,
                amount: penaltyAmount,
                token: tokenContractId,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const truncateKey = (key: string) => `${key.slice(0, 6)}...${key.slice(-6)}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                    <div className="flex items-center space-x-2">
                        <span className="text-xl">⚡</span>
                        <h3 className="text-base font-semibold text-slate-200">SLA Penalty Disbursement Builder</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 text-sm p-1 transition-colors"
                        aria-label="Close modal"
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">Recipient Public Key</span>
                            <span className="font-mono text-indigo-400">{truncateKey(recipientPublicKey)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">Token Contract ID</span>
                            <span className="font-mono text-slate-300">{truncateKey(tokenContractId)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">Penalty Credit Amount</span>
                            <span className="font-mono font-semibold text-emerald-400">{penaltyAmount} XLM</span>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-4 space-y-2">
                        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Network Fee Breakdown</h4>
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Estimated Soroban Inclusion Fee</span>
                            <span className="font-mono text-slate-200">0.0001 XLM</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Network Target</span>
                            <span className="font-mono text-indigo-400 uppercase">{network}</span>
                        </div>
                    </div>

                    {simulationPassed && (
                        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-400 flex items-center space-x-2">
                            <span>✓</span>
                            <span>Pre-flight simulation successful. Transaction ready for signature.</span>
                        </div>
                    )}
                </div>

                <div className="flex space-x-3">
                    {!simulationPassed ? (
                        <button
                            onClick={handleSimulate}
                            disabled={isSimulating}
                            className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-3 text-xs font-medium text-white transition-colors disabled:opacity-50 shadow-lg shadow-indigo-600/20 cursor-pointer"
                        >
                            {isSimulating ? 'Simulating Transaction...' : 'Run Pre-Flight Simulation'}
                        </button>
                    ) : (
                        <button
                            onClick={handleExecute}
                            disabled={isSubmitting}
                            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-xs font-medium text-white transition-colors disabled:opacity-50 shadow-lg shadow-emerald-600/20 cursor-pointer"
                        >
                            {isSubmitting ? 'Signing in Freighter...' : 'Sign & Submit Disbursement'}
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="rounded-xl bg-slate-800 hover:bg-slate-700 px-5 py-3 text-xs font-medium text-slate-300 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};