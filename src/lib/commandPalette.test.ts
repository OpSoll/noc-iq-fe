import { describe, it, expect } from 'vitest';

import {
  ACTION_COMMANDS,
  buildCommandSet,
  commandsFromOutages,
  commandsFromSites,
  NAVIGATION_COMMANDS,
  nextIndex,
  searchCommands,
  type CommandItem,
} from '@/lib/commandPalette';

const OUTFAGES = [
  { id: '123', siteId: 'LHR-04', severity: 'major' },
  { id: '456', siteId: 'JFK-02', severity: 'minor' },
];

const SITES = [{ id: 'LHR-04', name: 'Heathrow' }];

const commandSet = () => buildCommandSet({ outages: OUTFAGES, sites: SITES });

describe('command catalog', () => {
  it('provides navigation for every top-level route', () => {
    const hrefs = NAVIGATION_COMMANDS.map((c) => c.href);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/',
        '/outages',
        '/payments',
        '/bulk-import',
        '/config',
        '/webhooks',
        '/setting',
      ])
    );
  });

  it('gives every command an id, label, and group', () => {
    for (const command of [...NAVIGATION_COMMANDS, ...ACTION_COMMANDS]) {
      expect(command.id).toBeTruthy();
      expect(command.label).toBeTruthy();
      expect(command.group).toBeTruthy();
    }
  });

  it('has no duplicate command ids', () => {
    const ids = commandSet().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('commandsFromOutages', () => {
  it('creates a navigable command per outage', () => {
    const commands = commandsFromOutages(OUTFAGES);
    expect(commands[0]).toMatchObject({
      id: 'outage-123',
      label: 'Outage 123',
      group: 'Outages',
      href: '/outages/123',
      hint: 'major',
    });
  });

  it('indexes the site id and severity as keywords', () => {
    expect(commandsFromOutages(OUTFAGES)[0].keywords).toEqual(
      expect.arrayContaining(['LHR-04', 'major', 'outage', 'incident'])
    );
  });

  it('caps the number of generated commands', () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ id: String(i) }));
    expect(commandsFromOutages(many)).toHaveLength(100);
  });
});

describe('commandsFromSites', () => {
  it('labels a site with its name and id', () => {
    expect(commandsFromSites(SITES)[0]).toMatchObject({
      id: 'site-LHR-04',
      label: 'Heathrow (LHR-04)',
      group: 'Sites',
    });
  });

  it('falls back to the bare id when the site has no name', () => {
    expect(commandsFromSites([{ id: 'ABC-01' }])[0].label).toBe('ABC-01');
  });

  it('url-encodes the site id in the filter link', () => {
    expect(commandsFromSites([{ id: 'A B/1' }])[0].href).toBe(
      '/outages?site=A%20B%2F1'
    );
  });
});

describe('searchCommands', () => {
  it('returns nothing for an empty query', () => {
    expect(searchCommands(commandSet(), '')).toEqual([]);
    expect(searchCommands(commandSet(), '   ')).toEqual([]);
  });

  it('finds a command by its label', () => {
    expect(searchCommands(commandSet(), 'Dashboard')[0].id).toBe('nav-dashboard');
  });

  it('finds a command by a keyword', () => {
    expect(searchCommands(commandSet(), 'csv').map((c) => c.id)).toEqual([
      'nav-bulk-import',
      'action-bulk-import',
    ]);
  });

  it('ranks an exact label match above a keyword match', () => {
    // "Webhooks" is the label of one command; others only have the keyword.
    expect(searchCommands(commandSet(), 'Webhooks')[0].id).toBe('nav-webhooks');
  });

  it('ranks a prefix match above a substring match', () => {
    const results = searchCommands(commandSet(), 'pay');
    expect(results[0].id).toBe('nav-payments');
  });

  it('requires every token to match, so extra words narrow the results', () => {
    expect(searchCommands(commandSet(), 'bulk import').map((c) => c.id)).toEqual([
      'nav-bulk-import',
      'action-bulk-import',
    ]);
    expect(searchCommands(commandSet(), 'bulk nonsense')).toEqual([]);
  });

  it('searches dynamic outages', () => {
    expect(searchCommands(commandSet(), '123')[0].id).toBe('outage-123');
  });

  it('searches dynamic sites by id and by name', () => {
    expect(searchCommands(commandSet(), 'LHR-04').map((c) => c.id)).toEqual([
      'site-LHR-04',
      'outage-123',
    ]);
    expect(searchCommands(commandSet(), 'heathrow')[0].id).toBe('site-LHR-04');
  });

  it('is case-insensitive', () => {
    expect(searchCommands(commandSet(), 'DASHBOARD')[0].id).toBe('nav-dashboard');
  });

  it('returns nothing when there is no match', () => {
    expect(searchCommands(commandSet(), 'zzzzzzz')).toEqual([]);
  });

  it('respects the result limit', () => {
    expect(searchCommands(commandSet(), 'a', 2).length).toBeLessThanOrEqual(2);
  });

  it('includes extra commands supplied by the caller', () => {
    const commands = buildCommandSet({
      extraCommands: [
        { id: 'custom', label: 'Run reconciliation', group: 'Actions' },
      ],
    });
    expect(searchCommands(commands, 'reconciliation')[0].id).toBe('custom');
  });

  it('produces a stable order for equally scored results', () => {
    const first = searchCommands(commandSet(), 'import').map((c) => c.id);
    const second = searchCommands(commandSet(), 'import').map((c) => c.id);
    expect(first).toEqual(second);
  });
});

describe('nextIndex', () => {
  it('moves forward and backward', () => {
    expect(nextIndex(0, 1, 3)).toBe(1);
    expect(nextIndex(2, -1, 3)).toBe(1);
  });

  it('wraps at both ends', () => {
    expect(nextIndex(2, 1, 3)).toBe(0);
    expect(nextIndex(0, -1, 3)).toBe(2);
  });

  it('returns 0 for an empty list', () => {
    expect(nextIndex(0, 1, 0)).toBe(0);
    expect(nextIndex(0, -1, 0)).toBe(0);
  });

  it('stays in range for a single-item list', () => {
    expect(nextIndex(0, 1, 1)).toBe(0);
    expect(nextIndex(0, -1, 1)).toBe(0);
  });
});
