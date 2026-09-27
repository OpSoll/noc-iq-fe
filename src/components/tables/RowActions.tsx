'use client';

/**
 * RowActions
 *
 * Per-row quick action menu for the outages table. It keeps the four actions an
 * operator needs (View Details, Resolve Outage, Export JSON, Soft Delete) one
 * keystroke away from any row instead of behind the details drawer.
 *
 * Behaviour
 * ──────────
 * • Availability is role gated through `useUIStore` (see
 *   `resolveAvailableActions`); unauthorised actions stay visible but render
 *   `disabled` with a `title` explaining which capability is missing, which is
 *   what WCAG 3.3.x asks for — never hide the affordance, explain it.
 * • Keyboard support comes from Radix `DropdownMenu`: the trigger is a real
 *   button, Arrow Up/Down rove between items, Enter/Space activates the
 *   focused item and Escape closes the menu.
 * • Soft Delete routes through `BatchConfirmDialog` for confirmation.
 * • Every handler can be injected, which keeps the component testable without
 *   a router, a toast host or the network.
 *
 * Closes #617 – Outage Table: Implement row action dropdown menu
 * (Edit, Resolve, Delete)
 */

import { useMemo, useRef, useState } from 'react';

import { BatchConfirmDialog } from '@/components/outages/BatchConfirmDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontalIcon } from '@/components/ui/icons';
import { downloadJson } from '@/lib/urlSyncAndExport';
import { cn } from '@/lib/utils';
import { deleteOutage, resolveOutage } from '@/services/outages';
import type { Capability, Role } from '@/services/capabilities';
import { useUIStore } from '@/store/uiStore';
import type { Outage } from '@/types/outages';

// ─── Domain types ─────────────────────────────────────────────────────────────

export type OutageActionId =
  | 'view-details'
  | 'resolve'
  | 'export-json'
  | 'soft-delete';

/** Every row action, in menu order. */
export const OUTAGE_ACTION_IDS: OutageActionId[] = [
  'view-details',
  'resolve',
  'export-json',
  'soft-delete',
];

/** Visible menu label per action. */
export const OUTAGE_ACTION_LABEL: Record<OutageActionId, string> = {
  'view-details': 'View Details',
  resolve: 'Resolve Outage',
  'export-json': 'Export JSON',
  'soft-delete': 'Soft Delete',
};

/**
 * Capability each action requires. `null` means "always allowed": the outages
 * list itself is already route guarded by `view:outages`, so re-checking it on
 * every row would only add noise.
 */
export const OUTAGE_ACTION_CAPABILITY: Record<
  OutageActionId,
  Capability | null
> = {
  'view-details': null,
  resolve: 'action:resolve-outage',
  'export-json': 'action:export-data',
  'soft-delete': 'action:delete-outage',
};

/** Human readable capability requirement, used in the disabled `title`. */
const OUTAGE_ACTION_REQUIREMENT: Record<OutageActionId, string> = {
  'view-details': '',
  resolve: 'the "action:resolve-outage" capability',
  'export-json': 'the "action:export-data" capability',
  'soft-delete': 'the "action:delete-outage" capability',
};

/** What a given action does, resolved without touching the network. */
export type RowActionPlan<TPayload = Outage> =
  | { kind: 'view-details'; id: string; href: string }
  | { kind: 'resolve'; id: string; mttrMinutes: number }
  | { kind: 'export-json'; id: string; filename: string; payload: TPayload }
  | { kind: 'confirm-soft-delete'; id: string };

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Actions the given role may run on this outage: capability gated, and
 * "Resolve" is withheld from outages that are already resolved.
 */
export function resolveAvailableActions(
  outage: Pick<Outage, 'status'>,
  capabilities: Capability[]
): OutageActionId[] {
  const granted = new Set(capabilities);

  return OUTAGE_ACTION_IDS.filter((id) => {
    if (id === 'resolve' && outage.status === 'resolved') return false;
    const required = OUTAGE_ACTION_CAPABILITY[id];
    return required === null || granted.has(required);
  });
}

/** Explains, in the menu item's `title`, why an action is unavailable. */
export function describeDisabledAction(
  id: OutageActionId,
  outage: Pick<Outage, 'status'>,
  role: Role | null
): string {
  if (id === 'resolve' && outage.status === 'resolved') {
    return 'This outage is already resolved.';
  }

  const requirement = OUTAGE_ACTION_REQUIREMENT[id];
  if (!requirement) return 'Not available for this outage.';

  const active = role ?? 'none';
  return `Requires ${requirement}; the active role (${active}) lacks it.`;
}

/** Whole minutes between `detected_at` and `now`, floored at zero. */
export function elapsedMinutesSince(
  detectedAt: string,
  now: number = Date.now()
): number {
  const detected = Date.parse(detectedAt);
  if (Number.isNaN(detected)) return 0;
  return Math.max(0, Math.round((now - detected) / 60_000));
}

/**
 * Turns an action id into the operation it performs. Exported (and pure) so
 * the menu handlers can be asserted without opening the Radix portal in jsdom.
 */
export function planRowAction<
  TPayload extends Pick<Outage, 'id' | 'detected_at'>,
>(
  action: OutageActionId,
  outage: TPayload,
  now: number = Date.now()
): RowActionPlan<TPayload> {
  const id = outage.id;

  switch (action) {
    case 'view-details':
      return {
        kind: 'view-details',
        id,
        href: `/outages/${encodeURIComponent(id)}`,
      };
    case 'resolve':
      return {
        kind: 'resolve',
        id,
        mttrMinutes: Math.max(1, elapsedMinutesSince(outage.detected_at, now)),
      };
    case 'export-json':
      return {
        kind: 'export-json',
        id,
        filename: `outage-${id}.json`,
        payload: outage,
      };
    case 'soft-delete':
      return { kind: 'confirm-soft-delete', id };
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RowActionsProps {
  /** The outage every menu item acts on. */
  outage: Outage;
  /** Capabilities of the active role; defaults to useUIStore. */
  capabilities?: Capability[];
  /** Replaces the built-in "open the details page" navigation. */
  onViewDetails?: (outage: Outage) => void;
  /** Replaces the built-in resolve request. */
  onResolve?: (outage: Outage) => void | Promise<void>;
  /** Replaces the built-in JSON download. */
  onExportJson?: (outage: Outage) => void;
  /** Replaces the built-in delete request, still behind the confirmation. */
  onSoftDelete?: (outage: Outage) => void | Promise<void>;
  /** Blocks every item while the host is already mutating the row. */
  busy?: boolean;
  /** Extra classes for the trigger button. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * RowActions
 *
 * Renders a ghost icon button that opens the quick action menu. Arrow keys
 * rove between the items, Enter or Space runs the focused one, and Escape
 * dismisses the menu — all handled by Radix, which also owns the
 * `aria-haspopup` / `aria-expanded` contract on the trigger.
 */
export function RowActions({
  outage,
  capabilities,
  onViewDetails,
  onResolve,
  onExportJson,
  onSoftDelete,
  busy = false,
  className,
}: RowActionsProps) {
  const storeCapabilities = useUIStore((state) => state.capabilities);
  const storeRole = useUIStore((state) => state.role);

  const granted = capabilities ?? storeCapabilities;
  const role = capabilities ? null : storeRole;

  const [status, setStatus] = useState('');
  const [pending, setPending] = useState<OutageActionId | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const available = useMemo(
    () => resolveAvailableActions(outage, granted),
    [outage, granted]
  );

  function announce(message: string) {
    setStatus(message);
  }

  async function performSoftDelete() {
    setPending('soft-delete');
    try {
      if (onSoftDelete) {
        await onSoftDelete(outage);
        return;
      }
      await deleteOutage(outage.id);
      announce(`Outage ${outage.id} soft deleted.`);
    } catch (error) {
      announce(
        error instanceof Error ? error.message : 'Failed to delete the outage.'
      );
    } finally {
      setPending(null);
    }
  }

  async function execute(action: OutageActionId, plan: RowActionPlan) {
    if (plan.kind === 'confirm-soft-delete') {
      setConfirmOpen(true);
      return;
    }

    setPending(action);
    try {
      switch (plan.kind) {
        case 'view-details': {
          if (onViewDetails) onViewDetails(outage);
          else window.location.assign(plan.href);
          announce(`Opening details for outage ${plan.id}.`);
          break;
        }
        case 'resolve': {
          if (onResolve) await onResolve(outage);
          else await resolveOutage(plan.id, { mttr_minutes: plan.mttrMinutes });
          announce(`Outage ${plan.id} resolved.`);
          break;
        }
        case 'export-json': {
          if (onExportJson) onExportJson(outage);
          else downloadJson(plan.filename, plan.payload);
          announce(`Exported outage ${plan.id} as JSON.`);
          break;
        }
      }
    } catch (error) {
      announce(
        error instanceof Error
          ? error.message
          : `Failed to run ${plan.kind} on outage ${plan.id}.`
      );
    } finally {
      setPending(null);
    }
  }

  function handleSelect(id: OutageActionId) {
    if (busy || !available.includes(id)) return;
    void execute(id, planRowAction(id, outage));
  }

  return (
    <div className={cn('flex items-center', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for outage ${outage.id}`}
            aria-haspopup="menu"
            disabled={busy || pending !== null}
          >
            <MoreHorizontalIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate text-xs text-slate-500">
            {outage.site_name || outage.id}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="sr-only">
            Use the arrow keys to move between actions and Enter to run the
            selected one.
          </DropdownMenuLabel>

          {OUTAGE_ACTION_IDS.map((id) => {
            const isAvailable =
              available.includes(id) && !busy && pending === null;
            const isDestructive = id === 'soft-delete';

            return (
              <DropdownMenuItem
                key={id}
                disabled={!isAvailable}
                title={
                  isAvailable
                    ? undefined
                    : describeDisabledAction(id, outage, role)
                }
                onSelect={() => handleSelect(id)}
                className={cn(
                  isDestructive &&
                    'text-red-600 focus:bg-red-50 focus:text-red-700'
                )}
              >
                {OUTAGE_ACTION_LABEL[id]}
                {pending === id && (
                  <span className="ml-auto text-xs text-slate-400">…</span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <BatchConfirmDialog
        open={confirmOpen}
        operation="soft-delete"
        selectedCount={1}
        progress={null}
        hasUnresolved={false}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void performSoftDelete();
        }}
      />

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}
