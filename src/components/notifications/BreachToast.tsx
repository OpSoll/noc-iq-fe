'use client';

/**
 * BreachToast
 *
 * Alerts the operator when a background SLA recalculation turns an open
 * critical outage into a breached one. The repo's own toast stack
 * (`@/components/ui/toast`) renders non-interactive messages that disappear
 * after four seconds, so this component renders its own `role="alert"` live
 * region that keeps an "Open Remediation" action alive long enough to be used.
 *
 * The realtime outage stream only carries `outage.status_changed`, so breach
 * detection polls the open critical outages plus the per-severity SLA config
 * and derives the breach with `computeMinutesRemaining` from `@/lib/slaBreach`.
 *
 * Closes #605
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Volume2, VolumeX, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AlertTriangleIcon } from '@/components/ui/icons';
import { useToast } from '@/components/ui/toast';
import { announce } from '@/hooks/useOutageRealtime';
import { useSlaConfig } from '@/hooks/useSlaConfig';
import { queryKeys } from '@/lib/queryKeys';
import {
  computeMinutesRemaining,
  type SeverityThresholdMap,
} from '@/lib/slaBreach';
import { getOutages } from '@/services/outages';
import type { Outage, Severity } from '@/types/outages';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Same shape as the dashboard's open-critical outages query, so both
 * components share a single react-query cache entry instead of double-fetching.
 */
export const BREACH_OUTAGES_PARAMS = {
  status: 'open',
  severity: 'critical',
  page_size: 50,
} as const;

/** localStorage key for the (opt-in) audible breach cue. */
export const ALERT_SOUND_KEY = 'noc_breach_alert_sound';

const REFETCH_MS = 30_000;
const TICK_MS = 30_000;
const SOUND_FREQUENCY_HZ = 660;
const SOUND_DURATION_S = 0.18;
const SOUND_GAIN = 0.05;
const MINUTES_PER_DAY = 1440;
const MINUTES_PER_HOUR = 60;

// ─── Domain types ────────────────────────────────────────────────────────────

export interface SlaBreachEvent {
  /** Outage the breach belongs to; doubles as the dedupe key. */
  outageId: string;
  /** Site whose SLA target was breached. */
  siteName: string;
  /** Severity tier whose threshold was exceeded. */
  severity: Severity;
  /** Minutes the outage ran past its threshold. Always positive. */
  deltaMinutes: number;
}

export interface BreachNotice {
  /** Dedupe key (the outage id). */
  key: string;
  siteName: string;
  severity: Severity;
  deltaMinutes: number;
  /** Pre-formatted delta copy, e.g. `+2h 15m over threshold`. */
  deltaLabel: string;
  headline: string;
  message: string;
  /** Remediation route the toast action navigates to. */
  href: string;
}

export interface BreachEventDeps {
  /** Keys of breaches already presented; repeats are ignored. */
  seen: ReadonlySet<string>;
  /** Invoked with the notice when a genuinely new breach is detected. */
  onPresent: (notice: BreachNotice) => void;
  /** Optional audible cue, invoked only for newly presented breaches. */
  onAlertSound?: () => void;
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

/** Human-readable breach delta, e.g. `+2h 15m over threshold`. */
export function formatBreachDelta(deltaMinutes: number): string {
  if (!Number.isFinite(deltaMinutes) || deltaMinutes <= 0) {
    return 'at threshold';
  }

  const total = Math.floor(deltaMinutes);
  const days = Math.floor(total / MINUTES_PER_DAY);
  if (days > 0) {
    const hours = Math.floor((total % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
    return hours
      ? `+${days}d ${hours}h over threshold`
      : `+${days}d over threshold`;
  }

  const hours = Math.floor(total / MINUTES_PER_HOUR);
  const minutes = total % MINUTES_PER_HOUR;
  if (hours > 0) {
    return minutes
      ? `+${hours}h ${minutes}m over threshold`
      : `+${hours}h over threshold`;
  }
  return `+${minutes}m over threshold`;
}

/** Remediation route for a breached outage: its incident detail page. */
export function buildRemediationHref(outageId: string): string {
  return `/outages/${encodeURIComponent(outageId)}`;
}

/** Builds a breach event for an outage, or `null` while it is still in SLA. */
export function buildBreachEvent(
  outage: Outage,
  thresholdMinutes: number,
  now: Date = new Date()
): SlaBreachEvent | null {
  const minutesRemaining = computeMinutesRemaining(
    outage.detected_at,
    thresholdMinutes,
    now
  );
  if (Number.isNaN(minutesRemaining) || minutesRemaining >= 0) return null;

  return {
    outageId: outage.id,
    siteName: outage.site_name,
    severity: outage.severity,
    deltaMinutes: Math.abs(minutesRemaining),
  };
}

/** All currently breached open outages, worst breach first. */
export function collectBreachEvents(
  outages: Outage[],
  thresholds: SeverityThresholdMap,
  now: Date = new Date()
): SlaBreachEvent[] {
  const events: SlaBreachEvent[] = [];

  for (const outage of outages) {
    if (outage.status !== 'open') continue;
    const config = thresholds[outage.severity];
    if (!config) continue;
    const event = buildBreachEvent(outage, config.threshold_minutes, now);
    if (event) events.push(event);
  }

  return events.sort((a, b) => b.deltaMinutes - a.deltaMinutes);
}

/**
 * Decides whether an incoming breach is new and, if so, what to present.
 *
 * Repeated recalculations of the same outage must not re-toast, so the caller
 * owns a `seen` set of breach/outage ids and this function refuses to
 * re-announce anything already in it. Returns the presented notice, or `null`
 * when the event is not a breach or has already been handled.
 */
export function handleBreachEvent(
  event: SlaBreachEvent | null | undefined,
  deps: BreachEventDeps
): BreachNotice | null {
  if (!event) return null;
  if (!Number.isFinite(event.deltaMinutes) || event.deltaMinutes <= 0) {
    return null;
  }
  if (deps.seen.has(event.outageId)) return null;

  const deltaLabel = formatBreachDelta(event.deltaMinutes);
  const notice: BreachNotice = {
    key: event.outageId,
    siteName: event.siteName,
    severity: event.severity,
    deltaMinutes: event.deltaMinutes,
    deltaLabel,
    headline: `SLA target breached at ${event.siteName}`,
    message: `${event.siteName} breached its SLA target — ${deltaLabel}.`,
    href: buildRemediationHref(event.outageId),
  };

  deps.onPresent(notice);
  deps.onAlertSound?.();
  return notice;
}

// ─── Alert sound preference ──────────────────────────────────────────────────

/** The audible cue is opt-in: nothing plays until the operator enables it. */
export function getAlertSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ALERT_SOUND_KEY) === 'on';
  } catch {
    return false;
  }
}

export function setAlertSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.setItem(ALERT_SOUND_KEY, 'on');
    } else {
      window.localStorage.removeItem(ALERT_SOUND_KEY);
    }
  } catch {
    // Private-mode / blocked storage: the preference is session-only.
  }
}

/**
 * Two-tone Web Audio cue for a new breach. Fully guarded: playback is skipped
 * unless the preference is on, and any failure (no Web Audio support, blocked
 * autoplay, no user gesture yet) is swallowed.
 */
export function playBreachAlertSound(): void {
  if (!getAlertSoundEnabled()) return;

  try {
    const legacy = window as unknown as {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioCtor = window.AudioContext ?? legacy.webkitAudioContext;
    if (!AudioCtor) return;

    const context = new AudioCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = SOUND_FREQUENCY_HZ;
    gain.gain.value = SOUND_GAIN;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + SOUND_DURATION_S);
    oscillator.onended = () => {
      void context.close().catch(() => undefined);
    };
  } catch {
    // Web Audio unavailable or playback rejected by the autoplay policy.
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BreachToast() {
  const router = useRouter();
  const toast = useToast();
  const [now, setNow] = useState<Date>(() => new Date());
  const [notice, setNotice] = useState<BreachNotice | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    getAlertSoundEnabled()
  );
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = setTimeout(() => setNow(new Date()), TICK_MS);
    return () => clearTimeout(id);
  }, [now]);

  const outagesQuery = useQuery({
    queryKey: queryKeys.outages.list({ ...BREACH_OUTAGES_PARAMS }),
    queryFn: () => getOutages({ ...BREACH_OUTAGES_PARAMS }),
    staleTime: 15_000,
    refetchInterval: REFETCH_MS,
  });

  const configQuery = useSlaConfig();

  const thresholds = useMemo<SeverityThresholdMap>(() => {
    const map: SeverityThresholdMap = {};
    for (const entry of configQuery.data ?? []) {
      map[entry.severity] = { threshold_minutes: entry.threshold_minutes };
    }
    return map;
  }, [configQuery.data]);

  const breaches = useMemo(
    () =>
      collectBreachEvents(outagesQuery.data?.items ?? [], thresholds, now),
    [outagesQuery.data, thresholds, now]
  );

  useEffect(() => {
    // One toast per breach: the worst unseen breach is presented, and its key
    // is recorded so later recalculations of the same outage stay silent.
    const next = breaches.find((b) => !seenRef.current.has(b.outageId));
    if (!next) return;

    handleBreachEvent(next, {
      seen: seenRef.current,
      onPresent: (presented) => {
        seenRef.current.add(presented.key);
        setNotice(presented);
        toast(presented.message, 'error');
        announce(presented.message);
      },
      onAlertSound: playBreachAlertSound,
    });
  }, [breaches, toast]);

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setAlertSoundEnabled(next);
  }

  if (!notice) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="fixed bottom-4 left-4 z-[100] w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-red-200 bg-white p-4 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <span className="text-red-600" aria-hidden="true">
          <AlertTriangleIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">
            {notice.headline}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">{notice.message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => router.push(notice.href)}
            >
              Open Remediation
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-pressed={soundEnabled}
              aria-label={
                soundEnabled
                  ? 'Mute breach alert sound'
                  : 'Enable breach alert sound'
              }
              onClick={toggleSound}
            >
              {soundEnabled ? (
                <Volume2 aria-hidden="true" />
              ) : (
                <VolumeX aria-hidden="true" />
              )}
              {soundEnabled ? 'Sound on' : 'Sound off'}
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss SLA breach alert"
          onClick={() => setNotice(null)}
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default BreachToast;
