import React from 'react';

interface DisputeBondCardProps {
    disputedAmount: number; // in XLM or USDC value
    walletBalance: number;
    bondPercentage?: number; // default 5%
    unbondingPeriodDays?: number; // default 14 days
    onInitiateDispute?: () => void;
}

export const DisputeBondCard: React.FC<DisputeBondCardProps> = ({
    disputedAmount,
    walletBalance,
    bondPercentage = 5,
    unbondingPeriodDays = 14,
    onInitiateDispute,
}) => {
    // Calculate required bond collateral requirement (e.g. 5% of disputed value)
    const requiredBond = (disputedAmount * bondPercentage) / 100;
    const hasSufficientBalance = walletBalance >= requiredBond;

    return (
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-xl text-slate-100 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-200">Dispute Bond Collateral</h3>
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-400">
                    {bondPercentage}% Required Bond
                </span>
            </div>

            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Filing a dispute requires locking a collateral bond to prevent frivolous claims. Bonds are returned upon successful dispute resolution or subject to unbonding terms.
            </p>

            <div className="space-y-4 mb-6 bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Disputed Value:</span>
                    <span className="font-mono font-medium text-slate-200">{disputedAmount.toLocaleString()} XLM</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Required Bond ({bondPercentage}%):</span>
                    <span className="font-mono font-semibold text-indigo-400">{requiredBond.toLocaleString()} XLM</span>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-slate-700/50 pt-3">
                    <span className="text-slate-400">Wallet Balance:</span>
                    <span className={`font-mono font-medium ${hasSufficientBalance ? 'text-emerald-400' : 'text-red-400'}`}>
                        {walletBalance.toLocaleString()} XLM
                    </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Unbonding Terms:</span>
                    <span>{unbondingPeriodDays}-day lockup period</span>
                </div>
            </div>

            {!hasSufficientBalance && (
                <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 flex items-start space-x-2">
                    <span>⚠️</span>
                    <span>Insufficient wallet balance to cover the required dispute bond collateral.</span>
                </div>
            )}

            <button
                onClick={onInitiateDispute}
                disabled={!hasSufficientBalance}
                className={`w-full rounded-lg py-2.5 text-sm font-medium transition-colors ${
                    hasSufficientBalance
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
            >
                {hasSufficientBalance ? 'Lock Bond & File Dispute' : 'Insufficient Balance'}
            </button>
        </div>
    );
};