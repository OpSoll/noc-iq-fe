import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TableStatusPill, formatRelativeAge } from './TableStatusPill';

// ─── formatRelativeAge ───────────────────────────────────────────────────────

describe('formatRelativeAge', () => {
  it('collapses anything under five seconds to "just now"', () => {
    expect(formatRelativeAge(0)).toBe('just now');
    expect(formatRelativeAge(4_999)).toBe('just now');
  });

  it('counts seconds up to a minute', () => {
    expect(formatRelativeAge(5_000)).toBe('5s ago');
    expect(formatRelativeAge(59_999)).toBe('59s ago');
  });

  it('counts minutes up to an hour', () => {
    expect(formatRelativeAge(60_000)).toBe('1m ago');
    expect(formatRelativeAge(59 * 60_000)).toBe('59m ago');
  });

  it('counts hours up to a day', () => {
    expect(formatRelativeAge(60 * 60_000)).toBe('1h ago');
    expect(formatRelativeAge(23 * 60 * 60_000)).toBe('23h ago');
  });

  it('counts days beyond that', () => {
    expect(formatRelativeAge(24 * 60 * 60_000)).toBe('1d ago');
    expect(formatRelativeAge(3 * 24 * 60 * 60_000)).toBe('3d ago');
  });
});

// ─── TableStatusPill ─────────────────────────────────────────────────────────

describe('TableStatusPill', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-27T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function advance(seconds: number) {
    act(() => {
      vi.advanceTimersByTime(seconds * 1_000);
    });
  }

  it('reports that the table was never refreshed', () => {
    render(<TableStatusPill />);

    expect(screen.getByText('Not refreshed yet')).toBeInTheDocument();
  });

  it('reports the age of a numeric timestamp', () => {
    render(<TableStatusPill updatedAt={Date.now() - 30_000} />);

    expect(screen.getByText('Updated 30s ago')).toBeInTheDocument();
  });

  it('accepts a date and an ISO string', () => {
    const { unmount } = render(
      <TableStatusPill updatedAt={new Date(Date.now() - 120_000)} />
    );
    expect(screen.getByText('Updated 2m ago')).toBeInTheDocument();
    unmount();

    render(<TableStatusPill updatedAt="2026-03-27T11:58:00.000Z" />);
    expect(screen.getByText('Updated 2m ago')).toBeInTheDocument();
  });

  it('falls back to the "not refreshed" state for an invalid date', () => {
    render(<TableStatusPill updatedAt="not-a-date" />);

    expect(screen.getByText('Not refreshed yet')).toBeInTheDocument();
  });

  it('keeps ticking while the page is open', () => {
    render(<TableStatusPill updatedAt={Date.now() - 4_000} />);
    expect(screen.getByText('Updated just now')).toBeInTheDocument();

    advance(1);
    expect(screen.getByText('Updated 5s ago')).toBeInTheDocument();

    advance(55);
    expect(screen.getByText('Updated 1m ago')).toBeInTheDocument();
  });

  it('clamps a future timestamp to "just now"', () => {
    render(<TableStatusPill updatedAt={Date.now() + 60_000} />);

    expect(screen.getByText('Updated just now')).toBeInTheDocument();
  });

  it('omits the refresh button without a handler', () => {
    render(<TableStatusPill updatedAt={Date.now()} />);

    expect(
      screen.queryByRole('button', { name: /refresh outages now/i })
    ).not.toBeInTheDocument();
  });

  it('calls the handler when the refresh button is pressed', () => {
    const onRefresh = vi.fn();
    render(<TableStatusPill updatedAt={Date.now()} onRefresh={onRefresh} />);

    const button = screen.getByRole('button', { name: /refresh outages now/i });
    fireEvent.click(button);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables the button while a refresh is running', () => {
    render(
      <TableStatusPill
        updatedAt={Date.now()}
        isRefreshing
        onRefresh={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: /refresh outages now/i })
    ).toBeDisabled();
  });

  it('does not tick before the first refresh', () => {
    render(<TableStatusPill />);

    advance(10);

    expect(screen.getByText('Not refreshed yet')).toBeInTheDocument();
  });
});
