import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';

import {
  ColumnToggle,
  DEFAULT_COLUMN_STORAGE_KEY,
  formatVisibilitySummary,
  parseStoredColumns,
  serializeColumns,
  toggleColumn,
  type ColumnOption,
} from '@/components/tables/ColumnToggle';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COLUMNS: ColumnOption[] = [
  { id: 'title', label: 'Title' },
  { id: 'severity', label: 'Severity' },
  { id: 'status', label: 'Status' },
  { id: 'createdAt', label: 'Created' },
];

const KNOWN = COLUMNS.map((column) => column.id);

let user: UserEvent;

beforeEach(() => {
  user = userEvent.setup();
  window.localStorage.clear();
});

/**
 * Opens the column menu. Radix toggles it on `pointerdown`, so a jsdom without
 * `PointerEvent` only answers the keyboard path.
 */
async function openMenu() {
  await user.click(screen.getByRole('button', { name: /columns/i }));
  if (screen.queryByRole('menu') === null) {
    await user.keyboard('{ArrowDown}');
  }
}

/**
 * Renders a controlled harness so the parent owns the visible set, exactly
 * like the TanStack-backed table does.
 */
function renderToggle(initial: string[] = KNOWN) {
  const Harness = () => {
    const [visible, setVisible] = useState(initial);
    return (
      <ColumnToggle columns={COLUMNS} visible={visible} onChange={setVisible} />
    );
  };

  return render(<Harness />);
}

// ─── Pure helper tests ────────────────────────────────────────────────────────

describe('parseStoredColumns', () => {
  it('returns null when nothing is stored', () => {
    expect(parseStoredColumns(null, KNOWN)).toBeNull();
  });

  it('returns null for corrupt or non-array payloads', () => {
    expect(parseStoredColumns('not json', KNOWN)).toBeNull();
    expect(parseStoredColumns('{"title":true}', KNOWN)).toBeNull();
  });

  it('drops unknown ids and restores table order', () => {
    expect(
      parseStoredColumns('["status","ghost","title"]', KNOWN)
    ).toEqual(['title', 'status']);
  });

  it('returns null when the stored set is entirely unusable', () => {
    expect(parseStoredColumns('["ghost"]', KNOWN)).toBeNull();
    expect(parseStoredColumns('[]', KNOWN)).toBeNull();
  });

  it('round-trips through serializeColumns', () => {
    expect(parseStoredColumns(serializeColumns(['severity']), KNOWN)).toEqual([
      'severity',
    ]);
  });
});

describe('toggleColumn', () => {
  it('adds a hidden column back', () => {
    expect(toggleColumn(['title'], 'severity')).toEqual(['title', 'severity']);
  });

  it('removes a visible column', () => {
    expect(toggleColumn(['title', 'severity'], 'severity')).toEqual(['title']);
  });

  it('refuses to hide the last remaining column', () => {
    expect(toggleColumn(['title'], 'title')).toEqual(['title']);
  });
});

describe('formatVisibilitySummary', () => {
  it('describes the visible fraction', () => {
    expect(formatVisibilitySummary(KNOWN, 4)).toBe('4 of 4 columns visible.');
    expect(formatVisibilitySummary(['title'], 1)).toBe(
      '1 of 1 column visible.'
    );
  });
});

// ─── Component tests ──────────────────────────────────────────────────────────

describe('ColumnToggle', () => {
  it('shows how many columns are visible on the trigger', () => {
    renderToggle();

    const trigger = screen.getByRole('button', { name: /columns/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveTextContent('4/4');
  });

  it('exposes a checkbox per column, all checked initially', async () => {
    renderToggle();
    await openMenu();

    for (const column of COLUMNS) {
      const item = screen.getByRole('menuitemcheckbox', {
        name: column.label,
      });
      expect(item).toHaveAttribute('aria-checked', 'true');
    }
  });

  it('hides a column and reports the next visible set', async () => {
    renderToggle();
    await openMenu();
    const trigger = screen.getByRole('button', { name: /columns/i });

    const severity = screen.getByRole('menuitemcheckbox', {
      name: 'Severity',
    });
    await user.click(severity);

    const live = screen.getByRole('status');
    await waitFor(() => expect(live).toHaveTextContent('3 of 4 columns'));

    expect(severity).toHaveAttribute('aria-checked', 'false');
    expect(trigger).toHaveTextContent('3/4');
  });

  it('persists the choice for the next visit', async () => {
    renderToggle();
    await openMenu();

    const status = screen.getByRole('menuitemcheckbox', { name: 'Status' });
    await user.click(status);

    const expected = serializeColumns(['title', 'severity', 'createdAt']);
    await waitFor(() => {
      const stored = window.localStorage.getItem(DEFAULT_COLUMN_STORAGE_KEY);
      expect(stored).toBe(expected);
    });
  });

  it('restores the stored columns on mount', async () => {
    const stored = serializeColumns(['title', 'createdAt']);
    window.localStorage.setItem(DEFAULT_COLUMN_STORAGE_KEY, stored);

    renderToggle();
    const trigger = screen.getByRole('button', { name: /columns/i });

    await waitFor(() => expect(trigger).toHaveTextContent('2/4'));
  });

  it('keeps the defaults when storage holds nothing usable', () => {
    window.localStorage.setItem(DEFAULT_COLUMN_STORAGE_KEY, '["ghost"]');

    renderToggle();

    const trigger = screen.getByRole('button', { name: /columns/i });
    expect(trigger).toHaveTextContent('4/4');
  });

  it('never lets the operator hide every column', async () => {
    const onChange = vi.fn();
    render(
      <ColumnToggle columns={COLUMNS} visible={['title']} onChange={onChange} />
    );
    await openMenu();

    const title = screen.getByRole('menuitemcheckbox', { name: 'Title' });
    await user.click(title);

    const live = screen.getByRole('status');
    await waitFor(() =>
      expect(live).toHaveTextContent('At least one column must stay')
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the menu open so several columns can be toggled', async () => {
    renderToggle();
    await openMenu();

    const severity = screen.getByRole('menuitemcheckbox', {
      name: 'Severity',
    });
    await user.click(severity);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    const status = screen.getByRole('menuitemcheckbox', { name: 'Status' });
    await user.click(status);

    const trigger = screen.getByRole('button', { name: /columns/i });
    await waitFor(() => expect(trigger).toHaveTextContent('2/4'));
  });
});
