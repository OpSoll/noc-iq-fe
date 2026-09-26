import React from 'react';

interface SignerStatus {
    publicKey: string;
    hasSigned: boolean;
}

interface MultiSigProgressProps {
    threshold: number;
    totalRequiredWeight: number;
    currentWeight: number;
    signers: SignerStatus[];
    onSubmitDisbursement?: () => void;
}

export const MultiSigProgress: React.FC<MultiSigProgressProps> = ({
    threshold,
    totalRequiredWeight,
    currentWeight,
    signers,
    onSubmitDisbursement,
}) => {
    const isThresholdMet = currentWeight >= threshold;
    const progressPercentage = Math.min(100, (currentWeight / threshold) * 100);

    const truncateKey = (key: string) => `${key.slice(0, 4)}...${key.slice(-4)}`;

    return (
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-xl text-slate-100 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-200">Multi-Sig Authorization</h3>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium border ${
                    isThresholdMet 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                    {currentWeight} of {threshold} Weight
                </span>
            </div>

            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Disbursements require approval quorum across authorized administrative signers before on-chain execution.
            </p>

            {/* Progress Bar */}
            <div className="space-y-2 mb-6">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Signature Quorum Progress</span>
                    <span className="font-mono font-medium text-slate-200">{progressPercentage.toFixed(0)}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden border border-slate-700/50">
                    <div 
                        className={`h-full transition-all duration-500 ${isThresholdMet ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
            </div>

            {/* Signers List */}
            <div className="space-y-3 mb-6 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Authorized Signers</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {signers.map((signer, index) => (
                        <div key={index} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/60 last:border-0">
                            <div className="flex items-center space-x-2">
                                <span className={`h-2 w-2 rounded-full ${signer.hasSigned ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                                <span className="font-mono text-slate-300">{truncateKey(signer.publicKey)}</span>
                            </div>
                            <span className={`font-medium ${signer.hasSigned ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {signer.hasSigned ? 'Signed ✓' : 'Pending'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <button
                onClick={onSubmitDisbursement}
                disabled={!isThresholdMet}
                className={`w-full rounded-lg py-2.5 text-sm font-medium transition-colors ${
                    isThresholdMet
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-lg shadow-emerald-600/20'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
            >
                {isThresholdMet ? 'Execute Disbursement' : `Awaiting Quorum (${currentWeight}/${threshold})`}
            </button>
        </div>
    );
};