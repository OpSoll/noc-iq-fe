import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import RouteFocusManager, {
  ensureFocusableHeading,
  findMainHeading,
} from '@/components/RouteFocusManager';

const pathnameRef = { current: '/outages' };

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.current,
}));

function renderApp() {
  return render(
    <div>
      <RouteFocusManager />
      <main>
        <h1>Outages</h1>
        <p>Table goes here.</p>
      </main>
      <div id="route-announcer" role="status" aria-live="polite" />
    </div>
  );
}

beforeEach(() => {
  pathnameRef.current = '/outages';
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('findMainHeading', () => {
  it('finds the h1 inside main', () => {
    document.body.innerHTML = '<main><h1>Outages</h1></main>';
    expect(findMainHeading()?.textContent).toBe('Outages');
  });

  it('prefers a heading inside main over one elsewhere', () => {
    document.body.innerHTML =
      '<h1>Site title</h1><main><h1>Outages</h1></main>';
    expect(findMainHeading()?.textContent).toBe('Outages');
  });

  it('returns null when there is no heading', () => {
    document.body.innerHTML = '<main><p>No heading</p></main>';
    expect(findMainHeading()).toBeNull();
  });

  it('handles a page with no main landmark', () => {
    document.body.innerHTML = '<div><h1>Orphan</h1></div>';
    expect(findMainHeading()?.textContent).toBe('Orphan');
  });
});

describe('ensureFocusableHeading', () => {
  it('adds tabindex=-1 to a plain heading', () => {
    document.body.innerHTML = '<main><h1>Outages</h1></main>';
    const heading = findMainHeading()!;

    ensureFocusableHeading(heading);

    expect(heading).toHaveAttribute('tabindex', '-1');
  });

  it('does not overwrite an existing tabindex', () => {
    document.body.innerHTML = '<main><h1 tabindex="0">Outages</h1></main>';
    const heading = findMainHeading()!;

    ensureFocusableHeading(heading);

    expect(heading).toHaveAttribute('tabindex', '0');
  });
});

describe('RouteFocusManager', () => {
  it('renders nothing itself', () => {
    const { container } = render(
      <div>
        <RouteFocusManager />
        <main>
          <h1>Outages</h1>
        </main>
      </div>
    );
    expect(container.querySelector('[data-testid]')).toBeNull();
  });

  it('does not steal focus on the initial render', async () => {
    renderApp();

    // Give the effect a chance to run.
    await waitFor(() => {
      expect(document.activeElement).not.toBe(
        document.querySelector('h1')
      );
    });
  });

  it('moves focus to the main h1 on a route change', async () => {
    const { rerender } = render(
      <div>
        <RouteFocusManager />
        <main>
          <h1>Outages</h1>
        </main>
        <div id="route-announcer" role="status" />
      </div>
    );

    pathnameRef.current = '/outages/incident/timeline';
    rerender(
      <div>
        <RouteFocusManager />
        <main>
          <h1>Incident #9</h1>
        </main>
        <div id="route-announcer" role="status" />
      </div>
    );

    await waitFor(() => {
      const heading = document.querySelector('h1')!;
      expect(heading).toHaveTextContent('Incident #9');
      expect(document.activeElement).toBe(heading);
    });
  });

  it('adds tabindex=-1 to the heading it focuses', async () => {
    const { rerender } = render(
      <div>
        <RouteFocusManager />
        <main>
          <h1>Outages</h1>
        </main>
        <div id="route-announcer" role="status" />
      </div>
    );

    pathnameRef.current = '/payments';
    rerender(
      <div>
        <RouteFocusManager />
        <main>
          <h1>Payments</h1>
        </main>
        <div id="route-announcer" role="status" />
      </div>
    );

    await waitFor(() =>
      expect(document.querySelector('h1')).toHaveAttribute('tabindex', '-1')
    );
  });

  it('announces the new page title in the live region', async () => {
    const { rerender } = render(
      <div>
        <RouteFocusManager />
        <main>
          <h1>Outages</h1>
        </main>
        <div id="route-announcer" role="status" aria-live="polite" />
      </div>
    );

    pathnameRef.current = '/bulk-import/history';
    rerender(
      <div>
        <RouteFocusManager />
        <main>
          <h1>Import History</h1>
        </main>
        <div id="route-announcer" role="status" aria-live="polite" />
      </div>
    );

    await waitFor(() =>
      expect(document.getElementById('route-announcer')).toHaveTextContent(
        'Home, Bulk Import, History'
      )
    );
  });

  it('does not crash when the page has no heading', async () => {
    const { rerender } = render(
      <div>
        <RouteFocusManager />
        <main>
          <h1>Outages</h1>
        </main>
        <div id="route-announcer" role="status" />
      </div>
    );

    pathnameRef.current = '/outages';
    expect(() =>
      rerender(
        <div>
          <RouteFocusManager />
          <main>
            <p>No heading on this page.</p>
          </main>
          <div id="route-announcer" role="status" />
        </div>
      )
    ).not.toThrow();

    await waitFor(() => {
      expect(document.getElementById('route-announcer')).toHaveTextContent(
        'Home, Outages'
      );
    });
  });

  it('does not crash when the live region is absent', async () => {
    const { rerender } = render(
      <div>
        <RouteFocusManager announce={false} />
        <main>
          <h1>Outages</h1>
        </main>
      </div>
    );

    pathnameRef.current = '/payments';
    expect(() =>
      rerender(
        <div>
          <RouteFocusManager announce={false} />
          <main>
            <h1>Payments</h1>
          </main>
        </div>
      )
    ).not.toThrow();
  });

  it('can be disabled', async () => {
    const { rerender } = render(
      <div>
        <RouteFocusManager enabled={false} />
        <main>
          <h1>Outages</h1>
        </main>
        <div id="route-announcer" role="status" />
      </div>
    );

    pathnameRef.current = '/payments';
    rerender(
      <div>
        <RouteFocusManager enabled={false} />
        <main>
          <h1>Payments</h1>
        </main>
        <div id="route-announcer" role="status" />
      </div>
    );

    await waitFor(() => {
      expect(document.getElementById('route-announcer')).toHaveTextContent('');
    });
  });
});
