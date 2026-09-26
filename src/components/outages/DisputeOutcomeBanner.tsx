import React from 'react';

export type DisputeOutcomeStatus = 'upheld' | 'dismissed' | 'pending';

interface DisputeOutcomeBannerProps {
    status: DisputeOutcomeStatus;
    resolutionDate: string;
    summaryMessage: string;
    disputeId: string;
    onViewDetails: (disputeId: string) => void;
}

export const DisputeOutcomeBanner: React.FC<DisputeOutcomeBannerProps> = ({
    status,
    resolutionDate,
    summaryMessage,
    disputeId,
    onViewDetails,
}) => {
    const isUpheld = status === 'upheld';
    const isPending = status === 'pending';

    const themeConfig = {
        upheld: {
            bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
            icon: '✅',
            title: `Dispute Upheld on ${resolutionDate}`,
        },
        dismissed: {
            bg: 'bg-slate-800/80 border-slate-700/80 text-slate-300',
            icon: 'ℹ️',
            title: `Dispute Dismissed on ${resolutionDate}`,
        },
        pending: {
            bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
            icon: '⏳',
            title: `Dispute Under Review (Filed ${resolutionDate})`,
        },
    }[status];

    return (
        <div className={`w-full rounded-xl border p-4 shadow-lg backdrop-blur-sm ${themeConfig.bg}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start space-x-3">
                    <span className="text-xl shrink-0 mt-0.5">{themeConfig.icon}</span>
                    <div>
                        <h4 className="text-sm font-semibold tracking-wide">{themeConfig.title}</h4>
                        <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{summaryMessage}</p>
                    </div>
                </div>
                <button
                    onClick={() => onViewDetails(disputeId)}
                    className="self-start sm:self-center shrink-0 rounded-lg bg-slate-900/60 hover:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 border border-slate-700/50 transition-colors"
                >
                    View Arbitration Details →
                </button>
            </div>
        </div>
    );
};