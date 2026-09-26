// src/components/notifications/DisputeRateLimitToast.tsx
import React, { useState, useEffect } from 'react';

interface DisputeRateLimitToastProps {
    isVisible: boolean;
    cooldownSecondsRemaining: number;
    onClose: () => void;
}

export const DisputeRateLimitToast: React.FC<DisputeRateLimitToastProps> = ({
    isVisible,
    cooldownSecondsRemaining,
    onClose,
}) => {
    const [timeLeft, setTimeLeft] = useState(cooldownSecondsRemaining);

    useEffect(() => {
        setTimeLeft(cooldownSecondsRemaining);
        if (cooldownSecondsRemaining <= 0) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [cooldownSecondsRemaining]);

    if (!isVisible) return null;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <div className="fixed bottom-5 right-5 z-50 flex items-center space-x-3 rounded-xl bg-slate-900 border border-amber-500/30 p-4 shadow-2xl text-slate-100 max-w-sm animate-slide-up backdrop-blur-md">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                ⏳
            </div>
            <div className="flex-1 min-w-0">
                <h5 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Rate Limit Reached</h5>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    You have reached the dispute filing frequency limit. Please wait before submitting another claim.
                </p>
                {timeLeft > 0 && (
                    <div className="mt-2 flex items-center space-x-2 text-xs font-mono text-slate-400">
                        <span>Cooldown:</span>
                        <span className="font-semibold text-amber-400">{formatTime(timeLeft)}</span>
                    </div>
                )}
            </div>
            <button
                onClick={onClose}
                className="self-start text-slate-400 hover:text-slate-200 text-sm p-1 transition-colors"
                aria-label="Close notification"
            >
                ✕
            </button>
        </div>
    );
};