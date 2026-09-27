import { describe, it, expect } from 'vitest';

import { getDeleteConfirmState, getEndpointLabel } from '@/lib/webhookDelete';

describe('getEndpointLabel', () => {
  it('reduces a full URL to host and final path segment', () => {
    expect(getEndpointLabel('https://example.com/hooks/noc')).toBe(
      'example.com/noc'
    );
  });

  it('drops a trailing slash', () => {
    expect(getEndpointLabel('https://example.com/')).toBe('example.com');
  });

  it('keeps a longer path readable by showing only the last segment', () => {
    expect(getEndpointLabel('https://example.com/a/b/c/d')).toBe('example.com/d');
  });

  it('falls back for a missing or empty URL', () => {
    expect(getEndpointLabel(null)).toBe('(no URL)');
    expect(getEndpointLabel('')).toBe('(no URL)');
    expect(getEndpointLabel('   ')).toBe('(no URL)');
  });

  it('returns a non-URL string verbatim', () => {
    expect(getEndpointLabel('not a url')).toBe('not a url');
  });
});

describe('getDeleteConfirmState', () => {
  const target = 'example.com/noc';

  it('blocks deletion when nothing is typed', () => {
    const state = getDeleteConfirmState('', target);
    expect(state.canDelete).toBe(false);
    expect(state.isConfirmed).toBe(false);
    expect(state.message).toMatch(/Type the endpoint/);
  });

  it('blocks deletion on a partial match', () => {
    const state = getDeleteConfirmState('example.com', target);
    expect(state.canDelete).toBe(false);
    expect(state.message).toBe('The text does not match the endpoint.');
  });

  it('allows deletion on an exact match', () => {
    const state = getDeleteConfirmState(target, target);
    expect(state.canDelete).toBe(true);
    expect(state.isConfirmed).toBe(true);
    expect(state.message).toBeNull();
  });

  it('ignores surrounding whitespace', () => {
    expect(getDeleteConfirmState(`  ${target}  `, target).canDelete).toBe(true);
  });

  it('is case-insensitive, since casing is not a safety concern', () => {
    expect(getDeleteConfirmState('EXAMPLE.COM/NOC', target).canDelete).toBe(true);
  });

  it('reports the typed value as not matching when it is wrong', () => {
    const state = getDeleteConfirmState('evil.com/noc', target);
    expect(state.isConfirmed).toBe(false);
    expect(state.canDelete).toBe(false);
  });

  it('refuses to confirm when the target has no identifier', () => {
    const state = getDeleteConfirmState('anything', '');
    expect(state.canDelete).toBe(false);
    expect(state.message).toMatch(/no identifier/);
  });

  it('handles nullish input', () => {
    expect(getDeleteConfirmState('', target).canDelete).toBe(false);
    expect(getDeleteConfirmState('  ', target).canDelete).toBe(false);
  });
});
