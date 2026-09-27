import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import ReserveAlertBadge from '@/components/wallet/ReserveAlertBadge';
import { STROOPS_PER_XLM } from '@/lib/stellarReserve';

const XLM = (amount: number) => amount * STROOPS_PER_XLM;

describe('ReserveAlertBadge', () => {
  it('renders the subentry count and computed minimum reserve', () => {
    render(
      <ReserveAlertBadge totalBalanceStroops={XLM(100)} subentryCount={10} />
    );

    expect(screen.getByTestId('reserve-subentries')).toHaveTextContent('10');
    // (2 + 10) * 0.5 XLM
    expect(screen.getByTestId('reserve-amount')).toHaveTextContent('6 XLM');
  });

  it('renders the total and available balance', () => {
    render(
      <ReserveAlertBadge totalBalanceStroops={XLM(100)} subentryCount={10} />
    );

    // 100 total - 6 reserve = 94 available
    expect(screen.getByTestId('reserve-available')).toHaveTextContent('94 XLM');
  });

  it('does not warn when the available balance is comfortable', () => {
    render(
      <ReserveAlertBadge totalBalanceStroops={XLM(100)} subentryCount={10} />
    );

    const badge = screen.getByTestId('reserve-alert-badge');
    expect(badge).toHaveAttribute('data-low', 'false');
    expect(screen.queryByTestId('reserve-warning')).not.toBeInTheDocument();
  });

  it('warns when the available balance is below 2 XLM', () => {
    // 3 XLM held, 1.5 XLM reserved -> 1.5 XLM available.
    render(
      <ReserveAlertBadge totalBalanceStroops={XLM(3)} subentryCount={1} />
    );

    const badge = screen.getByTestId('reserve-alert-badge');
    expect(badge).toHaveAttribute('data-low', 'true');
    // A low balance is announced assertively.
    expect(screen.getByRole('alert')).toBe(badge);

    const warning = screen.getByTestId('reserve-warning');
    expect(warning).toHaveTextContent('below 2 XLM');
    expect(warning).toHaveTextContent('tx_insufficient_balance');
  });

  it('warns when a large reserve consumes the whole balance', () => {
    // 500 XLM held but 1,000 subentries reserve 501 XLM.
    render(
      <ReserveAlertBadge totalBalanceStroops={XLM(500)} subentryCount={1000} />
    );

    expect(screen.getByTestId('reserve-alert-badge')).toHaveAttribute(
      'data-low',
      'true'
    );
    expect(screen.getByTestId('reserve-available')).toHaveTextContent('0 XLM');
  });

  it('treats exactly 2 XLM available as safe', () => {
    // 3 XLM held with 2 subentries -> 2 XLM reserved -> 1 XLM available.
    render(
      <ReserveAlertBadge totalBalanceStroops={XLM(3)} subentryCount={2} />
    );
    expect(screen.getByTestId('reserve-available')).toHaveTextContent('1 XLM');
    expect(screen.getByTestId('reserve-alert-badge')).toHaveAttribute(
      'data-low',
      'true'
    );

    // 4 XLM held with 4 subentries -> 3 XLM reserved -> exactly 1... use 4/2.
    // 3 XLM held with 0 subentries -> 1 XLM reserved -> 2 XLM available.
    render(
      <ReserveAlertBadge totalBalanceStroops={XLM(3)} subentryCount={0} />
    );
    const badges = screen.getAllByTestId('reserve-alert-badge');
    expect(badges[1]).toHaveAttribute('data-low', 'false');
  });

  it('supports a custom warning threshold', () => {
    render(
      <ReserveAlertBadge
        totalBalanceStroops={XLM(100)}
        subentryCount={10}
        warningThresholdXlm={200}
      />
    );
    expect(screen.getByTestId('reserve-alert-badge')).toHaveAttribute(
      'data-low',
      'true'
    );
  });

  it('honours a network-specific base reserve', () => {
    render(
      <ReserveAlertBadge
        totalBalanceStroops={XLM(100)}
        subentryCount={0}
        baseReserveStroops={STROOPS_PER_XLM}
      />
    );
    // 2 base entries at 1 XLM each
    expect(screen.getByTestId('reserve-amount')).toHaveTextContent('2 XLM');
  });

  it('handles a zero balance without dividing by zero', () => {
    render(<ReserveAlertBadge totalBalanceStroops={0} subentryCount={0} />);

    expect(screen.getByTestId('reserve-available')).toHaveTextContent('0 XLM');
    expect(screen.getByTestId('reserve-amount')).toHaveTextContent('1 XLM');
  });

  it('handles a non-finite balance defensively', () => {
    render(
      <ReserveAlertBadge
        totalBalanceStroops={Number.NaN}
        subentryCount={0}
      />
    );
    expect(screen.getByTestId('reserve-available')).toHaveTextContent('0 XLM');
  });

  it('summarises the figures in an accessible label', () => {
    render(
      <ReserveAlertBadge totalBalanceStroops={XLM(100)} subentryCount={10} />
    );
    expect(
      screen.getByLabelText(/Minimum reserve 6 XLM, available 94 XLM/i)
    ).toBeInTheDocument();
  });
});
