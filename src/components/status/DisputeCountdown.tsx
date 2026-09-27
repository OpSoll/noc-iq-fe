import React, { useState, useEffect } from 'react';

interface DisputeCountdownProps {
    deadlineTimestamp: number; // Unix timestamp in seconds
    onExpire?: () => void;
}

export const DisputeCountdown: React.FC<DisputeCountdownProps> = ({
    deadlineTimestamp,
    onExpire,
}) => {
    const [timeLeft, setTimeLeft] = useState<number>(() => {
        const now = Math.floor(Date.now() / 1000);
        return Math.max(0, deadlineTimestamp - now);
    });

    useEffect(() => {
        if (timeLeft <= 0) return;

        const timer = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            const remaining = Math.max(0, deadlineTimestamp - now);
            setTimeLeft(remaining);

            if (remaining === 0) {
                clearInterval(timer);
                if (onExpire) onExpire();
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [deadlineTimestamp, timeLeft, onExpire]);

    const days = Math.floor(timeLeft / (3600 * 24));
    const hours = Math.floor((timeLeft % (3600 * 24)) / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    const isUrgent = timeLeft < 86400; // Less than 24 hours

    return (
        <div
            className={`inline-flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-mono border backdrop-blur-sm ${
                isUrgent
                    ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse'
                    : 'bg-slate-800/80 border-slate-700/80 text-slate-200'
            }`}
        >
            <span className="text-sm">⏱️</span>
            <div className="flex items-center space-x-1 font-semibold">
                {days > 0 && <span>{days}d</span>}
                <span>{String(hours).padStart(2, '0')}h</span>
                <span>{String(minutes).padStart(2, '0')}m</span>
                <span>{String(seconds).padStart(2, '0')}s</span>
            </div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider pl-1 border-l border-slate-700">
                {timeLeft > 0 ? 'Remaining' : 'Expired'}
            </span>
        </div>
    );
};