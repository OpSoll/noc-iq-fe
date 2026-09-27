import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import {
  DEBOUNCE_MS,
  OutageSearchBar,
  createSearchMatcher,
  formatResultSummary,
  highlightMatches,
  matchesSearchTerm,
} from './OutageSearchBar';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const OUTAGE = {
  id: 'outage-1',
  site_name: 'Lagos Core POP',
  description: 'Fiber cut on the metro ring',
  severity: 'critical' as const,
  status: 'open' as const,
  detected_at: '2026-03-27T08:00:00.000Z',
  affected_services: ['Backhaul'],
};

// ─── createSearchMatcher unit tests ───────────────────────────────────────────

describe('createSearchMatcher', () => {
  it('matches everything for an empty term', () => {
    const matches = createSearchMatcher('   ');
    expect(matches('anything')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(createSearchMatcher('LAGOS')('lagos core pop')).toBe(true);
    expect(createSearchMatcher('lagos')('LAGOS CORE POP')).toBe(true);
  });

  it('rejects text that does not contain the term', () => {
    expect(createSearchMatcher('lagos')('accra edge node')).toBe(false);
  });

  it('ANDs multiple terms of one field', () => {
    const matches = createSearchMatcher('lagos fiber');
    expect(matches('Lagos fiber ring')).toBe(true);
    expect(matches('Lagos metro ring')).toBe(false);
  });
});

// ─── matchesSearchTerm unit tests ─────────────────────────────────────────────

describe('matchesSearchTerm', () => {
  it('matches on the outage id', () => {
    expect(matchesSearchTerm(OUTAGE, 'outage-1')).toBe(true);
  });

  it('matches on the site name', () => {
    expect(matchesSearchTerm(OUTAGE, 'core pop')).toBe(true);
  });

  it('matches on the description', () => {
    expect(matchesSearchTerm(OUTAGE, 'metro ring')).toBe(true);
  });

  it('falls back to the compact title used by list views', () => {
    expect(matchesSearchTerm({ id: '1', title: 'Bravo Outage' }, 'bravo'))
      .toBe(true);
  });

  it('ANDs tokens across the whole row', () => {
    expect(matchesSearchTerm(OUTAGE, 'lagos fiber')).toBe(true);
    expect(matchesSearchTerm(OUTAGE, 'lagos submarine')).toBe(false);
  });

  it('keeps every row when the term is blank', () => {
    expect(matchesSearchTerm(OUTAGE, '  ')).toBe(true);
  });
});

// ─── highlightMatches unit tests ──────────────────────────────────────────────

describe('highlightMatches', () => {
  it('returns a single plain segment when there is no term', () => {
    expect(highlightMatches('Lagos Core POP', '')).toEqual([
      { text: 'Lagos Core POP', match: false },
    ]);
  });

  it('splits the text around the match, preserving casing', () => {
    expect(highlightMatches('Lagos Core POP', 'core')).toEqual([
      { text: 'Lagos ', match: false },
      { text: 'Core', match: true },
      { text: ' POP', match: false },
    ]);
  });

  it('highlights every term of a multi-word query', () => {
    const segments = highlightMatches('Lagos fiber ring', 'lagos ring');
    expect(segments.filter((s) => s.match).map((s) => s.text)).toEqual([
      'Lagos',
      'ring',
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(highlightMatches('', 'lagos')).toEqual([]);
  });
});

// ─── formatResultSummary unit tests ───────────────────────────────────────────

describe('formatResultSummary', () => {
  it('describes a filtered result set', () => {
    expect(formatResultSummary(12, 340)).toBe('12 of 340 outages match');
  });

  it('uses the singular for a single match', () => {
    expect(formatResultSummary(1, 1)).toBe('1 of 1 outage matches');
  });

  it('handles an empty table', () => {
    expect(formatResultSummary(0, 0)).toBe('No outages to search');
  });
});

// ─── OutageSearchBar rendering ────────────────────────────────────────────────

describe('OutageSearchBar', () => {
  it('exposes a labelled search field', () => {
    render(<OutageSearchBar value="" onChange={vi.fn()} />);

    const input = screen.getByRole('searchbox', { name: 'Search outages' });
    expect(input).toHaveAttribute('type', 'search');
  });

  it('announces the result count in a polite live region', () => {
    render(
      <OutageSearchBar
        value="lagos"
        onChange={vi.fn()}
        resultCount={12}
        totalCount={340}
      />
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('12 of 340 outages match');
  });

  it('hides the result count when the caller omits the counts', () => {
    render(<OutageSearchBar value="lagos" onChange={vi.fn()} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('hides the clear button until something is typed', () => {
    render(<OutageSearchBar value="" onChange={vi.fn()} />);
    expect(
      screen.queryByRole('button', { name: 'Clear search' })
    ).not.toBeInTheDocument();
  });

  it('clears the term immediately on clear', async () => {
    const onChange = vi.fn();
    render(<OutageSearchBar value="lagos" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
});

// ─── Debounced search predicate ───────────────────────────────────────────────

describe('OutageSearchBar debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not report the term before the debounce window elapses', () => {
    const onChange = vi.fn();
    render(<OutageSearchBar value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'lagos' },
    });
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports the term once the debounce window elapses', () => {
    const onChange = vi.fn();
    render(<OutageSearchBar value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'lagos fiber' },
    });
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('lagos fiber');
  });

  it('collapses a burst of keystrokes into a single call', () => {
    const onChange = vi.fn();
    render(<OutageSearchBar value="" onChange={onChange} />);

    const input = screen.getByRole('searchbox');
    for (const value of ['l', 'la', 'lag', 'lago', 'lagos']) {
      fireEvent.change(input, { target: { value } });
      act(() => {
        vi.advanceTimersByTime(50);
      });
    }
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('lagos');
  });

  it('never re-reports a term the parent already holds', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <OutageSearchBar value="lagos" onChange={onChange} />
    );

    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS * 3);
    });
    rerender(<OutageSearchBar value="lagos" onChange={onChange} />);
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS * 3);
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
