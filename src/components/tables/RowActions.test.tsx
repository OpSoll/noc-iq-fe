import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';

import {
  OUTAGE_ACTION_IDS,
  OUTAGE_ACTION_LABEL,
  RowActions,
  describeDisabledAction,
  elapsedMinutesSince,
  planRowAction,
  resolveAvailableActions,
} from '@/components/tables/RowActions';
import type { Capability, Role } from '@/services/capabilities';
import { useUIStore } from '@/store/uiStore';
import type { Outage } from '@/types/outages';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = Date.parse('2026-03-04T10:30:00.000Z');

const OUTAGE: Outage = {
  id: 'out-1',
  site_name: 'Lagos Core POP',
  severity: 'critical',
  status: 'open',
  detected_at: '2026-03-04T08:30:00.000Z',
  description: 'Fiber cut on the metro ring',
  affected_services: ['internet'],
};

const ADMIN: Capability[] = [
  'action:resolve-outage',
  'action:export-data',
  'action:delete-outage',
];

function setRole(role: Role | null) {
  useUIStore.setState({
    role,
    capabilities: role === 'admin' ? ADMIN : [],
  });
}

const TRIGGER_NAME = 'Actions for outage out-1';

let user: UserEvent;

beforeEach(() => {
  user = userEvent.setup();
});

/**
 * Opens the menu with a real click. Radix toggles it on `pointerdown`, so a
 * jsdom without `PointerEvent` only responds to the keyboard path — the
 * fallback keeps the assertions about behaviour rather than about the DOM API
 * the environment happens to implement.
 */
async function openMenu() {
  const trigger = screen.getByRole('button', { name: TRIGGER_NAME });
  await user.click(trigger);

  if (screen.queryByRole('menu') === null) {
    await user.keyboard('{ArrowDown}');
  }

  return trigger;
}

// ─── Pure helper tests ────────────────────────────────────────────────────────

describe('resolveAvailableActions', () => {
  it('grants every action to a role holding the capabilities', () => {
    expect(resolveAvailableActions(OUTAGE, ADMIN)).toEqual(OUTAGE_ACTION_IDS);
  });

  it('never gates view details, since the list itself is route guarded', () => {
    expect(resolveAvailableActions(OUTAGE, [])).toEqual(['view-details']);
  });

  it('withholds resolve from an already resolved outage', () => {
    expect(
      resolveAvailableActions({ status: 'resolved' }, ADMIN)
    ).not.toContain('resolve');
  });
});

describe('elapsedMinutesSince', () => {
  it('returns whole elapsed minutes', () => {
    expect(elapsedMinutesSince(OUTAGE.detected_at, NOW)).toBe(120);
  });

  it('floors at zero and survives unparsable timestamps', () => {
    expect(elapsedMinutesSince('2026-03-04T11:00:00.000Z', NOW)).toBe(0);
    expect(elapsedMinutesSince('not-a-date', NOW)).toBe(0);
  });
});

describe('planRowAction', () => {
  it('routes view details to the outage page', () => {
    expect(planRowAction('view-details', OUTAGE, NOW)).toEqual({
      kind: 'view-details',
      id: 'out-1',
      href: '/outages/out-1',
    });
  });

  it('resolves with the measured mttr, never below one minute', () => {
    const fresh = { ...OUTAGE, detected_at: '2026-03-04T10:29:59.000Z' };
    expect(planRowAction('resolve', fresh, NOW)).toEqual({
      kind: 'resolve',
      id: 'out-1',
      mttrMinutes: 1,
    });
  });

  it('names the JSON export after the outage id', () => {
    expect(planRowAction('export-json', OUTAGE, NOW)).toEqual({
      kind: 'export-json',
      id: 'out-1',
      filename: 'outage-out-1.json',
      payload: OUTAGE,
    });
  });

  it('escalates soft delete to a confirmation', () => {
    expect(planRowAction('soft-delete', OUTAGE, NOW)).toEqual({
      kind: 'confirm-soft-delete',
      id: 'out-1',
    });
  });
});

describe('describeDisabledAction', () => {
  it('explains a missing capability and names the active role', () => {
    expect(describeDisabledAction('soft-delete', OUTAGE, 'viewer')).toBe(
      'Requires the "action:delete-outage" capability; the active role ' +
        '(viewer) lacks it.'
    );
  });

  it('explains an already resolved outage', () => {
    expect(
      describeDisabledAction('resolve', { status: 'resolved' }, 'admin')
    ).toBe('This outage is already resolved.');
  });
});

// ─── Menu behaviour ───────────────────────────────────────────────────────────

describe('RowActions menu', () => {
  beforeEach(() => {
    setRole('admin');
  });

  it('exposes a labelled menu trigger per row', () => {
    render(<RowActions outage={OUTAGE} />);

    const trigger = screen.getByRole('button', { name: TRIGGER_NAME });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('lists every documented action for an admin', async () => {
    render(<RowActions outage={OUTAGE} />);
    await openMenu();

    for (const id of OUTAGE_ACTION_IDS) {
      expect(
        screen.getByRole('menuitem', { name: OUTAGE_ACTION_LABEL[id] })
      ).not.toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('opens the menu from the keyboard alone', async () => {
    render(<RowActions outage={OUTAGE} />);

    const trigger = screen.getByRole('button', { name: TRIGGER_NAME });
    trigger.focus();
    expect(trigger).toHaveFocus();

    await user.keyboard('{ArrowDown}');

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('runs the focused item with Enter', async () => {
    const onResolve = vi.fn();
    render(<RowActions outage={OUTAGE} onResolve={onResolve} />);
    await openMenu();

    const resolve = screen.getByRole('menuitem', {
      name: OUTAGE_ACTION_LABEL.resolve,
    });
    resolve.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onResolve).toHaveBeenCalledWith(OUTAGE));
  });

  it('closes on Escape without running an action', async () => {
    const onSoftDelete = vi.fn();
    render(<RowActions outage={OUTAGE} onSoftDelete={onSoftDelete} />);
    const trigger = await openMenu();

    await user.keyboard('{Escape}');

    expect(
      screen.queryByRole('menuitem', {
        name: OUTAGE_ACTION_LABEL['soft-delete'],
      })
    ).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(onSoftDelete).not.toHaveBeenCalled();
  });

  it('hides destructive work behind a confirmation', async () => {
    const onSoftDelete = vi.fn();
    render(<RowActions outage={OUTAGE} onSoftDelete={onSoftDelete} />);
    await openMenu();

    await user.click(
      screen.getByRole('menuitem', {
        name: OUTAGE_ACTION_LABEL['soft-delete'],
      })
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Soft Delete Outage');
    expect(onSoftDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(onSoftDelete).toHaveBeenCalledWith(OUTAGE));
  });

  it('reports the outcome of a resolve through a live region', async () => {
    render(<RowActions outage={OUTAGE} onResolve={vi.fn()} />);
    await openMenu();

    await user.click(
      screen.getByRole('menuitem', { name: OUTAGE_ACTION_LABEL.resolve })
    );

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Outage out-1 resolved.'
      )
    );
  });
});

// ─── Permission gating ────────────────────────────────────────────────────────

describe('RowActions permissions', () => {
  beforeEach(() => {
    setRole('viewer');
  });

  it('keeps unauthorised actions visible, disabled and explained', async () => {
    render(<RowActions outage={OUTAGE} />);
    await openMenu();

    const viewDetails = screen.getByRole('menuitem', {
      name: OUTAGE_ACTION_LABEL['view-details'],
    });
    expect(viewDetails).not.toHaveAttribute('aria-disabled', 'true');

    const softDelete = screen.getByRole('menuitem', {
      name: OUTAGE_ACTION_LABEL['soft-delete'],
    });
    expect(softDelete).toHaveAttribute('aria-disabled', 'true');
    expect(softDelete).toHaveAttribute(
      'title',
      expect.stringContaining('action:delete-outage')
    );
  });

  it('never fires a disabled item', async () => {
    const onExportJson = vi.fn();
    render(
      <RowActions
        outage={OUTAGE}
        capabilities={[]}
        onExportJson={onExportJson}
      />
    );
    await openMenu();

    await user.click(
      screen.getByRole('menuitem', {
        name: OUTAGE_ACTION_LABEL['export-json'],
      })
    );

    expect(onExportJson).not.toHaveBeenCalled();
  });

  it('prefers injected capabilities over the store', async () => {
    const onSoftDelete = vi.fn();
    render(
      <RowActions
        outage={OUTAGE}
        capabilities={ADMIN}
        onSoftDelete={onSoftDelete}
      />
    );
    await openMenu();

    const softDelete = screen.getByRole('menuitem', {
      name: OUTAGE_ACTION_LABEL['soft-delete'],
    });
    expect(softDelete).not.toHaveAttribute('aria-disabled', 'true');
  });
});
