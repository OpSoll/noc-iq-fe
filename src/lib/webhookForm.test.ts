import { describe, it, expect } from 'vitest';

import {
  generateWebhookSecret,
  isPrivateHost,
  isWebhookFormValid,
  maskSecret,
  validateWebhookForm,
  WEBHOOK_HTTPS_ERROR,
  WEBHOOK_SECRET_ERROR,
  WEBHOOK_TOPICS,
  WEBHOOK_TOPICS_ERROR,
  WEBHOOK_URL_ERROR,
  type WebhookFormValues,
} from '@/lib/webhookForm';

const validValues = (overrides: Partial<WebhookFormValues> = {}): WebhookFormValues => ({
  url: 'https://example.com/hooks/noc',
  description: '',
  secret: '',
  topics: ['outage.created'],
  ...overrides,
});

describe('validateWebhookForm url', () => {
  it('accepts a public HTTPS URL', () => {
    expect(validateWebhookForm(validValues()).url).toBeUndefined();
  });

  it('rejects an empty URL', () => {
    expect(validateWebhookForm(validValues({ url: '' })).url).toBe(
      WEBHOOK_URL_ERROR
    );
  });

  it('rejects a malformed URL', () => {
    expect(validateWebhookForm(validValues({ url: 'not a url' })).url).toBe(
      WEBHOOK_URL_ERROR
    );
    expect(validateWebhookForm(validValues({ url: 'example.com' })).url).toBe(
      WEBHOOK_URL_ERROR
    );
  });

  it('rejects non-HTTP schemes', () => {
    expect(
      validateWebhookForm(validValues({ url: 'ftp://example.com/hook' })).url
    ).toBe(WEBHOOK_URL_ERROR);
    expect(
      validateWebhookForm(validValues({ url: 'javascript:alert(1)' })).url
    ).toBe(WEBHOOK_URL_ERROR);
  });

  it('allows plain HTTP when HTTPS is not required', () => {
    expect(
      validateWebhookForm(validValues({ url: 'http://example.com/hook' }), {
        requireHttps: false,
      }).url
    ).toBeUndefined();
  });

  it('forces HTTPS in production', () => {
    const errors = validateWebhookForm(
      validValues({ url: 'http://example.com/hook' }),
      { requireHttps: true }
    );
    expect(errors.url).toBe(WEBHOOK_HTTPS_ERROR);
    expect(errors.url).toMatch(/HTTPS/);
  });

  it('accepts HTTPS in production', () => {
    expect(
      validateWebhookForm(validValues(), { requireHttps: true }).url
    ).toBeUndefined();
  });

  it('rejects loopback and private hosts', () => {
    for (const url of [
      'https://localhost/hook',
      'https://127.0.0.1/hook',
      'https://10.1.2.3/hook',
      'https://192.168.1.10/hook',
      'https://172.16.0.5/hook',
      'https://169.254.169.254/hook',
    ]) {
      expect(validateWebhookForm(validValues({ url })).url).toMatch(
        /publicly routable/
      );
    }
  });
});

describe('isPrivateHost', () => {
  it('detects loopback and RFC 1918 ranges', () => {
    expect(isPrivateHost('localhost')).toBe(true);
    expect(isPrivateHost('api.localhost')).toBe(true);
    expect(isPrivateHost('127.0.0.1')).toBe(true);
    expect(isPrivateHost('10.0.0.1')).toBe(true);
    expect(isPrivateHost('172.16.0.1')).toBe(true);
    expect(isPrivateHost('192.168.1.1')).toBe(true);
    expect(isPrivateHost('169.254.169.254')).toBe(true);
  });

  it('does not treat public addresses as private', () => {
    expect(isPrivateHost('example.com')).toBe(false);
    expect(isPrivateHost('8.8.8.8')).toBe(false);
    // 172.32.x.x is public; only 172.16-31 is private.
    expect(isPrivateHost('172.32.0.1')).toBe(false);
    expect(isPrivateHost('172.15.0.1')).toBe(false);
  });

  it('handles the 0.0.0.0 range', () => {
    expect(isPrivateHost('0.0.0.0')).toBe(true);
  });
});

describe('validateWebhookForm secret', () => {
  it('allows a blank secret so one can be generated', () => {
    expect(validateWebhookForm(validValues({ secret: '' })).secret).toBeUndefined();
  });

  it('rejects a short secret', () => {
    expect(validateWebhookForm(validValues({ secret: 'short' })).secret).toBe(
      WEBHOOK_SECRET_ERROR
    );
  });

  it('accepts a sufficiently long URL-safe secret', () => {
    expect(
      validateWebhookForm(
        validValues({ secret: 'abcdefghijklmnop' })
      ).secret
    ).toBeUndefined();
    expect(
      validateWebhookForm(validValues({ secret: 'a-b_c-1234567890' })).secret
    ).toBeUndefined();
  });

  it('rejects characters outside the URL-safe alphabet', () => {
    expect(
      validateWebhookForm(validValues({ secret: 'abcdefghijklmno!' })).secret
    ).toBe(WEBHOOK_SECRET_ERROR);
    expect(
      validateWebhookForm(validValues({ secret: 'abcdefghijklmn p' })).secret
    ).toBe(WEBHOOK_SECRET_ERROR);
  });
});

describe('validateWebhookForm topics', () => {
  it('requires at least one topic', () => {
    expect(validateWebhookForm(validValues({ topics: [] })).topics).toBe(
      WEBHOOK_TOPICS_ERROR
    );
  });

  it('accepts multiple topics', () => {
    expect(
      validateWebhookForm(
        validValues({ topics: ['outage.created', 'sla.breached'] })
      ).topics
    ).toBeUndefined();
  });
});

describe('validateWebhookForm aggregation', () => {
  it('reports every failing field at once', () => {
    const errors = validateWebhookForm({
      url: 'nope',
      description: '',
      secret: 'tiny',
      topics: [],
    });

    expect(Object.keys(errors).sort()).toEqual(['secret', 'topics', 'url']);
  });

  it('is valid only when nothing is wrong', () => {
    expect(isWebhookFormValid(validValues())).toBe(true);
    expect(isWebhookFormValid(validValues({ url: 'nope' }))).toBe(false);
  });
});

describe('generateWebhookSecret', () => {
  it('produces a prefixed, long-enough secret', () => {
    const secret = generateWebhookSecret();
    expect(secret.startsWith('whsec_')).toBe(true);
    expect(secret.length).toBeGreaterThanOrEqual(16 + 'whsec_'.length);
  });

  it('validates against the form rules', () => {
    expect(
      validateWebhookForm(validValues({ secret: generateWebhookSecret() }))
        .secret
    ).toBeUndefined();
  });

  it('avoids visually ambiguous characters', () => {
    // The alphabet excludes I, O, 0, 1 so a secret can be retyped by hand.
    for (let i = 0; i < 50; i++) {
      expect(generateWebhookSecret().slice('whsec_'.length)).not.toMatch(
        /[IO01]/
      );
    }
  });

  it('does not repeat itself', () => {
    const secrets = new Set(
      Array.from({ length: 25 }, () => generateWebhookSecret())
    );
    expect(secrets.size).toBe(25);
  });

  it('enforces a minimum length', () => {
    expect(generateWebhookSecret(1)).toHaveLength('whsec_'.length + 16);
  });

  it('spreads characters across the whole alphabet', () => {
    const body = Array.from({ length: 200 }, () =>
      generateWebhookSecret(24).slice('whsec_'.length)
    ).join('');
    // All 32 alphabet members should show up across 4800 draws.
    expect(new Set(body.split('')).size).toBe(32);
  });
});

describe('maskSecret', () => {
  it('masks all but the prefix and tail', () => {
    expect(maskSecret('whsec_ABCDEFGHIJKL')).toBe('whsec_AB…IJKL');
  });

  it('fully masks a short secret', () => {
    expect(maskSecret('short')).toBe('••••••••');
  });
});

describe('WEBHOOK_TOPICS', () => {
  it('lists the supported event topics with labels', () => {
    expect(WEBHOOK_TOPICS.length).toBeGreaterThan(0);
    for (const topic of WEBHOOK_TOPICS) {
      expect(topic.value).toMatch(/^[a-z_]+\.[a-z_]+$/);
      expect(topic.label.length).toBeGreaterThan(0);
    }
    expect(WEBHOOK_TOPICS.map((t) => t.value)).toContain('outage.created');
  });
});
