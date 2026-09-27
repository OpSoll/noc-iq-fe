import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  DashboardGrid,
  DEFAULT_LAYOUT,
  DEFAULT_ORDER,
  LAYOUT_STORAGE_KEY,
  LAYOUT_VERSION,
  defaultLayoutFor,
  deserializeLayout,
  moveWidget,
  normalizeOrder,
  serializeLayout,
  type DashboardWidget,
} from './DashboardGrid';

const WIDGETS: DashboardWidget[] = [
  { id: 'alpha', title: 'Alpha widget', render: () => <p>Alpha body</p> },
  { id: 'beta', title: 'Beta widget', render: () => <p>Beta body</p> },
  { id: 'gamma', title: 'Gamma widget', render: () => <p>Gamma body</p> },
];

function renderGrid(widgets: DashboardWidget[] = WIDGETS) {
  return render(<DashboardGrid widgets={widgets} />);
}

/** Widget ids in the order the grid currently renders them. */
function renderedOrder(): string[] {
  return Array.from(document.querySelectorAll('[data-widget-id]')).map(
    (node) => node.getAttribute('data-widget-id') ?? ''
  );
}

beforeEach(() => {
  localStorage.clear();
});

// ─── Pure layout helpers ─────────────────────────────────────────────────────

describe('normalizeOrder', () => {
  it('appends ids that are missing from the stored order', () => {
    expect(normalizeOrder(['b'], ['a', 'b', 'c'])).toEqual(['b', 'a', 'c']);
  });

  it('drops unknown and duplicated ids', () => {
    expect(normalizeOrder(['c', 'ghost', 'a', 'a'], ['a', 'b', 'c'])).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('returns the prop order for an empty stored order', () => {
    expect(normalizeOrder([], ['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('moveWidget', () => {
  it('moves an entry forwards and backwards', () => {
    expect(moveWidget(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveWidget(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveWidget(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });

  it('is a no-op for out-of-range and identical indices', () => {
    const order = ['a', 'b'];
    expect(moveWidget(order, 1, 1)).toEqual(['a', 'b']);
    expect(moveWidget(order, -1, 0)).toEqual(['a', 'b']);
    expect(moveWidget(order, 0, 5)).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const order = ['a', 'b', 'c'];
    moveWidget(order, 0, 2);
    expect(order).toEqual(['a', 'b', 'c']);
  });
});

describe('serializeLayout', () => {
  it('writes a versioned payload with a stable hidden set', () => {
    const json = serializeLayout({
      order: ['b', 'a'],
      hidden: ['c', 'a'],
    });
    expect(JSON.parse(json)).toEqual({
      version: LAYOUT_VERSION,
      order: ['b', 'a'],
      hidden: ['a', 'c'],
    });
  });

  it('round-trips through deserializeLayout', () => {
    const defaults = defaultLayoutFor(['a', 'b', 'c']);
    const state = { order: ['c', 'b', 'a'], hidden: ['b'] };
    expect(deserializeLayout(serializeLayout(state), defaults)).toEqual(state);
  });
});

describe('deserializeLayout', () => {
  const defaults = defaultLayoutFor(['a', 'b', 'c']);

  it('falls back to defaults for missing, corrupt, or foreign payloads', () => {
    expect(deserializeLayout(null, defaults)).toEqual(defaults);
    expect(deserializeLayout(undefined, defaults)).toEqual(defaults);
    expect(deserializeLayout('{not json', defaults)).toEqual(defaults);
    expect(deserializeLayout('"a string"', defaults)).toEqual(defaults);
    expect(deserializeLayout('null', defaults)).toEqual(defaults);
    expect(
      deserializeLayout('{"version":99,"order":["c"],"hidden":[]}', defaults)
    ).toEqual(defaults);
  });

  it('drops unknown widget ids and hidden entries', () => {
    const raw = JSON.stringify({
      version: LAYOUT_VERSION,
      order: ['c', 'ghost'],
      hidden: ['ghost', 'a'],
    });
    expect(deserializeLayout(raw, defaults)).toEqual({
      order: ['c', 'a', 'b'],
      hidden: ['a'],
    });
  });

  it('re-appends widgets an older build never stored', () => {
    const raw = JSON.stringify({
      version: LAYOUT_VERSION,
      order: ['b'],
      hidden: [],
    });
    expect(deserializeLayout(raw, defaults).order).toEqual(['b', 'a', 'c']);
  });

  it('tolerates non-string and non-array members', () => {
    const raw = JSON.stringify({
      version: LAYOUT_VERSION,
      order: ['b', 42, null],
      hidden: 'nope',
    });
    expect(deserializeLayout(raw, defaults)).toEqual({
      order: ['b', 'a', 'c'],
      hidden: [],
    });
  });

  it('exposes an empty baseline that keeps every widget visible', () => {
    expect(DEFAULT_ORDER).toEqual([]);
    expect(DEFAULT_LAYOUT).toEqual({ order: [], hidden: [] });
  });
});

// ─── DashboardGrid ───────────────────────────────────────────────────────────

describe('DashboardGrid', () => {
  it('renders widgets in the prop order by default', () => {
    renderGrid();
    expect(renderedOrder()).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('persists the layout to a versioned localStorage key', async () => {
    const user = userEvent.setup();
    renderGrid();
    await user.click(screen.getByRole('button', { name: 'Customize' }));
    await user.click(screen.getByRole('button', { name: 'Move Beta up' }));

    await screen.findByRole('region', { name: 'Beta widget' });
    await waitFor(() => {
      expect(
        JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}')
      ).toEqual({
        version: LAYOUT_VERSION,
        order: ['beta', 'alpha', 'gamma'],
        hidden: [],
      });
    });
  });

  it('reorders with Alt + Arrow on the focused handle', async () => {
    const user = userEvent.setup();
    renderGrid();
    await user.click(screen.getByRole('button', { name: 'Customize' }));

    const handle = screen.getByRole('button', {
      name: /Reorder Gamma widget/,
    });
    handle.focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');

    expect(renderedOrder()).toEqual(['gamma', 'alpha', 'beta']);
  });

  it('hides and restores a widget from the customize panel', async () => {
    const user = userEvent.setup();
    renderGrid();
    await user.click(screen.getByRole('button', { name: 'Customize' }));

    const toggle = screen.getByRole('checkbox', { name: 'Beta widget' });
    await user.click(toggle);
    expect(renderedOrder()).toEqual(['alpha', 'gamma']);

    await user.click(toggle);
    expect(renderedOrder()).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('restores the default layout from Reset Layout', async () => {
    const user = userEvent.setup();
    renderGrid();
    await user.click(screen.getByRole('button', { name: 'Customize' }));
    await user.click(screen.getByRole('button', { name: 'Move Gamma up' }));
    await user.click(screen.getByRole('checkbox', { name: 'Alpha widget' }));
    expect(renderedOrder()).toEqual(['gamma', 'beta']);

    await user.click(screen.getByRole('button', { name: 'Reset Layout' }));
    expect(renderedOrder()).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('hydrates from a previously saved layout', () => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        version: LAYOUT_VERSION,
        order: ['gamma', 'beta', 'alpha'],
        hidden: ['beta'],
      })
    );

    renderGrid();
    expect(renderedOrder()).toEqual(['gamma', 'alpha']);
  });

  it('keeps rendering when the saved layout is corrupt', () => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, '{{{ not json');
    renderGrid();
    expect(renderedOrder()).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('exposes each widget as a labelled region with its rendered body', () => {
    renderGrid();
    const region = screen.getByRole('region', { name: 'Alpha widget' });
    expect(within(region).getByText('Alpha body')).toBeInTheDocument();
  });
});
