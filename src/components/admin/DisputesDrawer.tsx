'use client';

/**
 * Disputes filtering drawer for arbitrators (#643).
 * Lists active and resolved disputes with status filter pills.
 */

import { useMemo, useState } from 'react';
import Modal from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type DisputeDrawerStatus = 'open' | 'under_review' | 'settled';

export interface DisputeListItem {
  id: string;
  outageId: string;
  siteName: string;
  claimant: string;
  disputedValue: number;
  currency?: string;
  status: DisputeDrawerStatus;
  /** ISO deadline for resolution window. */
  deadlineAt: string;
}

export interface DisputesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  disputes: DisputeListItem[];
  /** Called when a row is activated — open full arbitration workspace. */
  onSelectDispute?: (dispute: DisputeListItem) => void;
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'settled', label: 'Settled' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

function timeLeftLabel(deadlineAt: string, now = Date.now()): string {
  const ms = new Date(deadlineAt).getTime() - now;
  if (Number.isNaN(ms)) return '—';
  if (ms <= 0) return 'Expired';
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days}d ${hours % 24}h`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${mins}m`;
}

function statusBadgeVariant(
  status: DisputeDrawerStatus,
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'open':
      return 'destructive';
    case 'under_review':
      return 'secondary';
    case 'settled':
      return 'outline';
  }
}

export function filterDisputes(
  disputes: DisputeListItem[],
  filter: FilterId,
): DisputeListItem[] {
  if (filter === 'all') return disputes;
  return disputes.filter((d) => d.status === filter);
}

export function DisputesDrawer({
  isOpen,
  onClose,
  disputes,
  onSelectDispute,
}: DisputesDrawerProps) {
  const [filter, setFilter] = useState<FilterId>('all');
  const rows = useMemo(
    () => filterDisputes(disputes, filter),
    [disputes, filter],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Disputes"
      maxWidth="max-w-5xl"
    >
      <div data-testid="disputes-drawer">
        <div
          className="mb-4 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Dispute status filter"
        >
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              type="button"
              size="sm"
              variant={filter === f.id ? 'default' : 'outline'}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              {f.id !== 'all' && (
                <span className="ml-1 opacity-70">
                  (
                  {disputes.filter((d) => d.status === f.id).length}
                  )
                </span>
              )}
            </Button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No disputes match this filter.
          </p>
        ) : (
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-background text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">Outage ID</th>
                  <th className="px-2 py-2">Site Name</th>
                  <th className="px-2 py-2">Claimant</th>
                  <th className="px-2 py-2">Disputed Value</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Time Left</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr
                    key={d.id}
                    className="cursor-pointer border-t border-border hover:bg-muted/50"
                    onClick={() => onSelectDispute?.(d)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectDispute?.(d);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open dispute ${d.id} for outage ${d.outageId}`}
                  >
                    <td className="px-2 py-2 font-mono text-xs">{d.outageId}</td>
                    <td className="px-2 py-2">{d.siteName}</td>
                    <td className="px-2 py-2">{d.claimant}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {d.disputedValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      {d.currency ?? 'USD'}
                    </td>
                    <td className="px-2 py-2">
                      <Badge variant={statusBadgeVariant(d.status)}>
                        {d.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {timeLeftLabel(d.deadlineAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default DisputesDrawer;
