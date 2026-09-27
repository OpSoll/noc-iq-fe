/**
 * Search and ranking for the global command palette.
 *
 * A palette is only useful if the first keystrokes find the thing, so ranking
 * is doing real work here: an exact match must always outrank a prefix match
 * that happens to appear earlier in the list, and matches are scored per token
 * so `out lnk` still finds "Outage link status".
 *
 * Closes #675 — Cmd+K / Ctrl+K global command palette search modal.
 */

export type CommandGroup = 'Navigation' | 'Outages' | 'Sites' | 'Actions' | 'Payments';

export interface CommandItem {
  id: string;
  label: string;
  group: CommandGroup;
  /** Route to navigate to, when the command is navigational. */
  href?: string;
  /** Extra terms that should also match this command. */
  keywords?: string[];
  /** Short hint rendered on the right of the row. */
  hint?: string;
}

export interface RankedCommand extends CommandItem {
  score: number;
}

/** Static navigation commands, always available. */
export const NAVIGATION_COMMANDS: CommandItem[] = [
  { id: 'nav-dashboard', label: 'Dashboard', group: 'Navigation', href: '/', keywords: ['home', 'overview', 'homepage'] },
  { id: 'nav-outages', label: 'Outages', group: 'Navigation', href: '/outages', keywords: ['incidents', 'downtime'] },
  { id: 'nav-payments', label: 'Payments', group: 'Navigation', href: '/payments', keywords: ['payouts', 'disbursements', 'xlm'] },
  { id: 'nav-bulk-import', label: 'Bulk import', group: 'Navigation', href: '/bulk-import', keywords: ['csv', 'import', 'upload'] },
  { id: 'nav-sla-config', label: 'SLA config', group: 'Navigation', href: '/config', keywords: ['sla', 'target', 'settings'] },
  { id: 'nav-webhooks', label: 'Webhooks', group: 'Navigation', href: '/webhooks', keywords: ['webhook', 'events', 'integrations'] },
  { id: 'nav-settings', label: 'Settings', group: 'Navigation', href: '/setting', keywords: ['preferences', 'account', 'profile'] },
];

export const ACTION_COMMANDS: CommandItem[] = [
  { id: 'action-create-outage', label: 'Log new outage', group: 'Actions', href: '/outages', keywords: ['create', 'new', 'incident', 'report'] },
  { id: 'action-bulk-import', label: 'Start bulk import', group: 'Actions', href: '/bulk-import', keywords: ['csv', 'upload', 'import'] },
  { id: 'action-register-webhook', label: 'Register webhook endpoint', group: 'Actions', href: '/webhooks', keywords: ['webhook', 'endpoint', 'integration'] },
];

const SCORE_EXACT = 1000;
const SCORE_PREFIX = 400;
const SCORE_WORD_PREFIX = 250;
const SCORE_SUBSTRING = 100;
const SCORE_KEYWORD = 60;

/** Lower is better, for stable sorting. */
function scoreItem(item: CommandItem, query: string): number {
  const label = item.label.toLowerCase();
  if (label === query) return -SCORE_EXACT;

  if (label.startsWith(query)) return -SCORE_PREFIX;

  if (label.split(/\s+/).some((word) => word.startsWith(query))) {
    return -SCORE_WORD_PREFIX;
  }

  if (label.includes(query)) return -SCORE_SUBSTRING;

  const keywords = item.keywords ?? [];
  if (keywords.some((k) => k.toLowerCase() === query)) return -SCORE_KEYWORD;
  if (keywords.some((k) => k.toLowerCase().startsWith(query))) {
    return -SCORE_KEYWORD + 1;
  }
  if (keywords.some((k) => k.toLowerCase().includes(query))) {
    return -SCORE_KEYWORD + 2;
  }

  return Number.POSITIVE_INFINITY;
}

/**
 * Ranks commands against a query.
 *
 * Every token must match somewhere, so extra words narrow the result rather
 * than being ignored. Results are capped so a single letter does not render
 * hundreds of rows.
 */
export function searchCommands(
  commands: CommandItem[],
  query: string,
  limit = 20
): RankedCommand[] {
  const trimmed = (query ?? '').trim().toLowerCase();
  if (!trimmed) return [];

  const tokens = trimmed.split(/\s+/).filter(Boolean);

  const scored: RankedCommand[] = [];
  for (const item of commands) {
    const haystack = [
      item.label,
      item.group,
      ...(item.keywords ?? []),
    ]
      .join(' ')
      .toLowerCase();

    if (!tokens.every((token) => haystack.includes(token))) continue;

    // Score against the full query first, then per token, taking the best.
    const candidates = [trimmed, ...tokens]
      .map((token) => scoreItem(item, token))
      .filter((score) => Number.isFinite(score));

    if (candidates.length === 0) continue;
    scored.push({ ...item, score: Math.min(...candidates) });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** Folds outage and site records into palette commands. */
export function commandsFromOutages(
  outages: Array<{ id: string; siteId?: string | null; severity?: string | null }>
): CommandItem[] {
  return outages.slice(0, 100).map((outage) => ({
    id: `outage-${outage.id}`,
    label: `Outage ${outage.id}`,
    group: 'Outages' as const,
    href: `/outages/${outage.id}`,
    hint: outage.severity ?? undefined,
    keywords: [outage.siteId ?? '', outage.severity ?? '', 'outage', 'incident']
      .filter(Boolean),
  }));
}

export function commandsFromSites(
  sites: Array<{ id: string; name?: string | null }>
): CommandItem[] {
  return sites.slice(0, 100).map((site) => ({
    id: `site-${site.id}`,
    label: site.name ? `${site.name} (${site.id})` : site.id,
    group: 'Sites' as const,
    href: `/outages?site=${encodeURIComponent(site.id)}`,
    hint: site.id,
    keywords: [site.id, site.name ?? '', 'site', 'location'],
  }));
}

/** Assembles the full command set for the palette. */
export function buildCommandSet(options: {
  outages?: Array<{ id: string; siteId?: string | null; severity?: string | null }>;
  sites?: Array<{ id: string; name?: string | null }>;
  extraCommands?: CommandItem[];
} = {}): CommandItem[] {
  return [
    ...NAVIGATION_COMMANDS,
    ...ACTION_COMMANDS,
    ...commandsFromOutages(options.outages ?? []),
    ...commandsFromSites(options.sites ?? []),
    ...(options.extraCommands ?? []),
  ];
}

/**
 * Clamps and wraps a highlighted index.
 *
 * Wrapping matters in a list that is navigated with the arrow keys: without it,
 * pressing Up on the first row dead-ends.
 */
export function nextIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return (((current + delta) % length) + length) % length;
}
