import { describe, expect, it } from 'vitest';
import { SITE_ID_ERROR, validateSiteId } from '@/lib/siteIdValidation';

describe('validateSiteId', () => {
  it.each(['SITE-01', 'site01', 'A1-B2'])(
    'accepts alphanumeric IDs with hyphens: %s',
    (value) => {
      expect(validateSiteId(value)).toBeNull();
    }
  );

  it('allows an empty optional site ID', () => {
    expect(validateSiteId('')).toBeNull();
  });

  it.each(['SITE_01', 'SITE 01', ' SITE-01', 'SITE-01 ', 'SITE/01'])(
    'rejects invalid characters and surrounding spaces: %s',
    (value) => {
      expect(validateSiteId(value)).toBe(SITE_ID_ERROR);
    }
  );
});
