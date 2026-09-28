import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  DisputesDrawer,
  filterDisputes,
  type DisputeListItem,
} from '../DisputesDrawer';

const disputes: DisputeListItem[] = [
  {
    id: 'd1',
    outageId: 'out-100',
    siteName: 'Lagos DC',
    claimant: 'Alice',
    disputedValue: 1200.5,
    status: 'open',
    deadlineAt: new Date(Date.now() + 36 * 3600_000).toISOString(),
  },
  {
    id: 'd2',
    outageId: 'out-200',
    siteName: 'Abuja Hub',
    claimant: 'Bob',
    disputedValue: 50,
    status: 'under_review',
    deadlineAt: new Date(Date.now() + 5 * 3600_000).toISOString(),
  },
  {
    id: 'd3',
    outageId: 'out-300',
    siteName: 'PH Edge',
    claimant: 'Carol',
    disputedValue: 10,
    status: 'settled',
    deadlineAt: new Date(Date.now() - 3600_000).toISOString(),
  },
];

describe('DisputesDrawer (#643)', () => {
  it('lists disputes with required columns', () => {
    render(
      <DisputesDrawer isOpen onClose={() => {}} disputes={disputes} />,
    );
    expect(screen.getByTestId('disputes-drawer')).toBeTruthy();
    expect(screen.getByText('Outage ID')).toBeTruthy();
    expect(screen.getByText('Site Name')).toBeTruthy();
    expect(screen.getByText('Claimant')).toBeTruthy();
    expect(screen.getByText('Disputed Value')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('Time Left')).toBeTruthy();
    expect(screen.getByText('out-100')).toBeTruthy();
    expect(screen.getByText('Lagos DC')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('filters by status pills', () => {
    render(
      <DisputesDrawer isOpen onClose={() => {}} disputes={disputes} />,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Settled/i }));
    expect(screen.getByText('out-300')).toBeTruthy();
    expect(screen.queryByText('out-100')).toBeNull();
  });

  it('invokes onSelectDispute when a row is activated', () => {
    const onSelect = vi.fn();
    render(
      <DisputesDrawer
        isOpen
        onClose={() => {}}
        disputes={disputes}
        onSelectDispute={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('out-100'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'd1', outageId: 'out-100' }),
    );
  });

  it('filterDisputes helper matches status', () => {
    expect(filterDisputes(disputes, 'open')).toHaveLength(1);
    expect(filterDisputes(disputes, 'all')).toHaveLength(3);
  });
});
