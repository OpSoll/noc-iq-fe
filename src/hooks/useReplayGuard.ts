import { useRef, useCallback } from "react";

export type ReplayGuardState = {
  canReplay: boolean;
  lastReplayAt: string | null;
  remainingCooldownMs: number;
};

export type ReplayAction = {
  webhookId: string;
  timestamp: string;
};

export function useReplayGuard(cooldownMs: number = 10_000) {
  const lastReplayRef = useRef<Map<string, number>>(new Map());

  const checkReplay = useCallback((webhookId: string): ReplayGuardState => {
    const last = lastReplayRef.current.get(webhookId) ?? 0;
    const elapsed = Date.now() - last;
    return {
      canReplay: elapsed >= cooldownMs,
      lastReplayAt: last > 0 ? new Date(last).toISOString() : null,
      remainingCooldownMs: Math.max(0, cooldownMs - elapsed),
    };
  }, [cooldownMs]);

  const markReplayed = useCallback((webhookId: string) => {
    lastReplayRef.current.set(webhookId, Date.now());
  }, []);

  const attemptReplay = useCallback((action: ReplayAction): { ok: boolean; reason?: string } => {
    const state = checkReplay(action.webhookId);
    if (!state.canReplay) {
      return { ok: false, reason: `Cooldown active. Wait ${state.remainingCooldownMs}ms before replaying.` };
    }
    markReplayed(action.webhookId);
    return { ok: true };
  }, [checkReplay, markReplayed]);

  return { checkReplay, markReplayed, attemptReplay };
}
