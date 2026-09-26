import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import {
  ALERT_SOUND_KEY,
  BreachToast,
  buildBreachEvent,
  buildRemediationHref,
  collectBreachEvents,
  formatBreachDelta,
  getAlertSoundEnabled,
  handleBreachEvent,
  playBreachAlertSound,
  setAlertSoundEnabled,
  type SlaBreachEvent,
} from './BreachToast';
import { ToastProvider } from '@/components/ui/toast';
import { getOutages } from '@/services/outages';
import type { Outage } from '@/types/outages';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/services/outages', () => ({
  getOutages: vi.fn(),
}));

vi.mock('@/hooks/useSlaConfig', () => ({
  useSlaConfig: () => ({
    data: [
      {
        severity: 'critical',
        threshold_minutes: 60,
        penalty_per_minute: 5,
        reward_base: 0,
      },
    ],
  }),
}));

const mockedGetOutages = vi.mocked(getOutages);

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

const NOW = new Date('2026-06-10T12:00:00Z');

function makeOutage(overrides: Partial<Outage> = {}): Outage {
  return {
    id: 'out-7',
    site_name: 'Site A',
    severity: 'critical',
    status: 'open',
    detected_at: '2026-06-10T09:00:00Z',
    description: 'link down',
    affected_services: ['backbone'],
    ...overrides,
  };
}

function makeEvent(
  overrides: Partial<SlaBreachEvent> = {}
): SlaBreachEvent {
  return {
    outageId: 'out-7',
    siteName: 'Site A',
    severity: 'critical',
    deltaMinutes: 15,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  mockedGetOutages.mockReset();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── formatBreachDelta ───────────────────────────────────────────────────────

describe('formatBreachDelta', () => {
  it('formats minutes and hours', () => {
    expect(formatBreachDelta(1)).toBe('+1m over threshold');
    expect(formatBreachDelta(59)).toBe('+59m over threshold');
    expect(formatBreachDelta(60)).toBe('+1h over threshold');
    expect(formatBreachDelta(135)).toBe('+2h 15m over threshold');
  });

  it('formats days', () => {
    expect(formatBreachDelta(1440)).toBe('+1d over threshold');
    expect(formatBreachDelta(1500)).toBe('+1d 1h over threshold');
  });

  it('degrades gracefully for non-breaches and junk input', () => {
    expect(formatBreachDelta(0)).toBe('at threshold');
    expect(formatBreachDelta(-5)).toBe('at threshold');
    expect(formatBreachDelta(Number.NaN)).toBe('at threshold');
  });
});

// ─── buildBreachEvent / collectBreachEvents ──────────────────────────────────

describe('buildBreachEvent', () => {
  it('returns null while the outage is still inside its threshold', () => {
    expect(buildBreachEvent(makeOutage(), 180, NOW)).toBeNull();
  });

  it('reports the minutes past the threshold once breached', () => {
    const event = buildBreachEvent(makeOutage(), 60, NOW);
    expect(event).toEqual({
      outageId: 'out-7',
      siteName: 'Site A',
      severity: 'critical',
      deltaMinutes: 180,
    });
  });

  it('returns null for an unparseable detection timestamp', () => {
    expect(buildBreachEvent(makeOutage({ detected_at: 'nope' }), 60, NOW))
      .toBeNull();
  });
});

describe('collectBreachEvents', () => {
  const thresholds = { critical: { threshold_minutes: 60 } };

  it('skips resolved outages and severities without a configured threshold', () => {
    const events = collectBreachEvents(
      [
        makeOutage({ id: 'resolved', status: 'resolved' }),
        makeOutage({ id: 'unconfigured', severity: 'high' }),
      ],
      thresholds,
      NOW
    );
    expect(events).toEqual([]);
  });

  it('orders the worst breach first', () => {
    const events = collectBreachEvents(
      [
        makeOutage({ id: 'mild', detected_at: '2026-06-10T11:30:00Z' }),
        makeOutage({ id: 'severe', detected_at: '2026-06-10T08:00:00Z' }),
      ],
      thresholds,
      NOW
    );
    expect(events.map((e) => e.outageId)).toEqual(['severe', 'mild']);
  });
});

// ─── handleBreachEvent ──────────────────────────────────────────────────────

describe('handleBreachEvent', () => {
  it('presents a new breach and fires the alert sound', () => {
    const seen = new Set<string>();
    const onPresent = vi.fn();
    const onAlertSound = vi.fn();

    const notice = handleBreachEvent(makeEvent(), {
      seen,
      onPresent,
      onAlertSound,
    });

    expect(notice).not.toBeNull();
    expect(notice?.headline).toBe('SLA target breached at Site A');
    expect(notice?.message).toBe(
      'Site A breached its SLA target — +15m over threshold.'
    );
    expect(notice?.href).toBe('/outages/out-7');
    expect(onPresent).toHaveBeenCalledWith(notice);
    expect(onAlertSound).toHaveBeenCalledTimes(1);
  });

  it('ignores a repeated recalculation of an already-seen outage', () => {
    const seen = new Set(['out-7']);
    const onPresent = vi.fn();
    const onAlertSound = vi.fn();

    const notice = handleBreachEvent(makeEvent(), {
      seen,
      onPresent,
      onAlertSound,
    });

    expect(notice).toBeNull();
    expect(onPresent).not.toHaveBeenCalled();
    expect(onAlertSound).not.toHaveBeenCalled();
  });

  it('dedupes by outage id, not by delta, so a growing breach stays silent', () => {
    const seen = new Set(['out-7']);
    expect(
      handleBreachEvent(makeEvent({ deltaMinutes: 900 }), {
        seen,
        onPresent: vi.fn(),
      })
    ).toBeNull();
  });

  it('ignores missing events and non-breach deltas', () => {
    const onPresent = vi.fn();
    expect(
      handleBreachEvent(null, { seen: new Set<string>(), onPresent })
    ).toBeNull();
    expect(
      handleBreachEvent(undefined, { seen: new Set<string>(), onPresent })
    ).toBeNull();
    expect(
      handleBreachEvent(makeEvent({ deltaMinutes: 0 }), {
        seen: new Set<string>(),
        onPresent,
      })
    ).toBeNull();
  });

  it('encodes the outage id in the remediation route', () => {
    expect(buildRemediationHref('out 7/x')).toBe('/outages/out%207%2Fx');
  });
});

// ─── Alert sound preference ──────────────────────────────────────────────────

describe('breach alert sound', () => {
  class FakeAudioContext {
    static instances: FakeAudioContext[] = [];
    currentTime = 0;
    createOscillator() {
      return {
        type: '',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as null | (() => void),
      };
    }
    createGain() {
      return { gain: { value: 0 }, connect: vi.fn() };
    }
    close() {
      return Promise.resolve();
    }
    constructor() {
      FakeAudioContext.instances.push(this);
    }
  }

  beforeEach(() => {
    FakeAudioContext.instances = [];
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  it('is opt-in and persists the preference', () => {
    expect(getAlertSoundEnabled()).toBe(false);

    setAlertSoundEnabled(true);
    expect(getAlertSoundEnabled()).toBe(true);
    expect(localStorage.getItem(ALERT_SOUND_KEY)).toBe('on');

    setAlertSoundEnabled(false);
    expect(getAlertSoundEnabled()).toBe(false);
    expect(localStorage.getItem(ALERT_SOUND_KEY)).toBeNull();
  });

  it('stays silent until the preference is enabled', () => {
    playBreachAlertSound();
    expect(FakeAudioContext.instances).toHaveLength(0);

    setAlertSoundEnabled(true);
    playBreachAlertSound();
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it('swallows audio failures instead of throwing', () => {
    setAlertSoundEnabled(true);
    vi.stubGlobal(
      'AudioContext',
      class {
        createOscillator() {
          throw new Error('blocked by autoplay policy');
        }
      }
    );
    expect(() => playBreachAlertSound()).not.toThrow();
  });
});

// ─── BreachToast ─────────────────────────────────────────────────────────────

describe('BreachToast', () => {
  it('stays hidden while every open outage is still inside its SLA', async () => {
    mockedGetOutages.mockResolvedValue({
      items: [makeOutage({ detected_at: new Date().toISOString() })],
      total: 1,
      page: 1,
      page_size: 50,
    });

    render(<BreachToast />, { wrapper });

    await waitFor(() => expect(mockedGetOutages).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces the site name and breach delta once an outage breaches', async () => {
    // 4 hours ago against a 60 minute critical threshold.
    const detectedAt = new Date(Date.now() - 240 * 60 * 1000).toISOString();
    mockedGetOutages.mockResolvedValue({
      items: [makeOutage({ detected_at: detectedAt })],
      total: 1,
      page: 1,
      page_size: 50,
    });

    render(<BreachToast />, { wrapper });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('SLA target breached at Site A');
    expect(alert).toHaveTextContent('+4h over threshold');
  });

  it('navigates to the SLA remediation view on Open Remediation', async () => {
    const user = userEvent.setup();
    mockedGetOutages.mockResolvedValue({
      items: [makeOutage({ id: 'out-9' })],
      total: 1,
      page: 1,
      page_size: 50,
    });

    render(<BreachToast />, { wrapper });

    await user.click(
      await screen.findByRole('button', { name: 'Open Remediation' })
    );
    expect(push).toHaveBeenCalledWith('/outages/out-9');
  });

  it('toggles the alert sound preference and can be dismissed', async () => {
    const user = userEvent.setup();
    mockedGetOutages.mockResolvedValue({
      items: [makeOutage()],
      total: 1,
      page: 1,
      page_size: 50,
    });

    render(<BreachToast />, { wrapper });

    const sound = await screen.findByRole('button', {
      name: 'Enable breach alert sound',
    });
    await user.click(sound);
    expect(getAlertSoundEnabled()).toBe(true);

    await user.click(
      screen.getByRole('button', { name: 'Dismiss SLA breach alert' })
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
