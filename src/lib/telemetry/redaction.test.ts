import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  redactForEmission,
  redactSensitiveText,
  REDACTED_TEXT,
  resetBlockedFields,
} from '@/lib/telemetry/privacy';
import {
  emitTelemetry,
  resetEmitFn,
  setEmitFn,
  createAuthEvent,
} from '@/lib/telemetry/events';
import { logErrorToTelemetry } from '@/components/AppErrorBoundary';
import type { ErrorInfo } from 'react';

/**
 * #977 — client error telemetry must never carry credentials.
 */
describe('telemetry redaction (#977)', () => {
  beforeEach(() => {
    resetBlockedFields();
    resetEmitFn();
    vi.restoreAllMocks();
  });

  describe('redactSensitiveText', () => {
    it('redacts an Authorization header value', () => {
      const out = redactSensitiveText(
        'Request failed: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def'
      );
      expect(out).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(out).toContain(REDACTED_TEXT);
      expect(out).toContain('Request failed');
    });

    it('redacts a bare Bearer token', () => {
      const out = redactSensitiveText('sent Bearer abcdef1234567890 to upstream');
      expect(out).not.toContain('abcdef1234567890');
      expect(out).toContain(`Bearer ${REDACTED_TEXT}`);
    });

    it('redacts token query parameters', () => {
      const out = redactSensitiveText('GET /api/outages?token=s3cr3tvalue&page=1');
      expect(out).not.toContain('s3cr3tvalue');
      expect(out).toContain('page=1');
    });

    it('redacts api_key and client_secret assignments', () => {
      const out = redactSensitiveText(
        'config api_key=ABCDEF123456 client_secret=shhh'
      );
      expect(out).not.toContain('ABCDEF123456');
      expect(out).not.toContain('shhh');
    });

    it('redacts a JWT anywhere in the string', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const out = redactSensitiveText(`payload ${jwt} end`);
      expect(out).not.toContain(jwt);
      expect(out).toContain(REDACTED_TEXT);
    });

    it('redacts a long bare opaque secret', () => {
      const secret = 'a'.repeat(40);
      expect(redactSensitiveText(`key=${secret}`)).not.toContain(secret);
    });

    it('leaves ordinary text untouched', () => {
      const text = 'Outage #42 was resolved after 3 attempts';
      expect(redactSensitiveText(text)).toBe(text);
    });

    it('handles empty/non-string safely', () => {
      expect(redactSensitiveText('')).toBe('');
    });
  });

  describe('redactForEmission', () => {
    it('redacts secrets in nested string values', () => {
      const result = redactForEmission({
        message: 'failed with Authorization: Bearer topsecretvalue',
        context: { url: '/x?access_token=leakme1' },
      });
      expect(result.message).not.toContain('topsecretvalue');
      expect(result.context.url).not.toContain('leakme1');
    });

    it('still redacts sensitive keys recursively', () => {
      const result = redactForEmission({ nested: { token: 'abc' } });
      expect(result.nested.token).toBe('[REDACTED]');
    });

    it('does not mutate the input', () => {
      const input = { message: 'Authorization: Bearer keepme123' };
      redactForEmission(input);
      expect(input.message).toContain('keepme123');
    });
  });

  describe('emitTelemetry', () => {
    it('emits a redacted event even when the payload carries a token', () => {
      const sink = vi.fn();
      setEmitFn(sink);

      emitTelemetry(
        createAuthEvent('login', '/login?token=supersecret', {
          userId: 'u1',
        })
      );

      expect(sink).toHaveBeenCalledOnce();
      const emitted = sink.mock.calls[0][0];
      expect(emitted.route).not.toContain('supersecret');
      expect(emitted.route).toContain(REDACTED_TEXT);
    });
  });

  describe('logErrorToTelemetry', () => {
    it('redacts tokens embedded in the message, stack and component stack', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error(
        'fetch failed: Authorization: Bearer leaky.jwt.token.value'
      );
      error.stack = 'Error: token=stacksecret123\n  at Handler';
      const info: ErrorInfo = {
        componentStack: '\n  at X\n  Authorization: Basic dXNlcjpwYXNz',
      };

      logErrorToTelemetry(error, info);

      const logged = spy.mock.calls[0].map((v) => String(v)).join(' ');
      expect(logged).not.toContain('leaky.jwt.token.value');
      expect(logged).not.toContain('stacksecret123');
      expect(logged).not.toContain('dXNlcjpwYXNz');
      expect(logged).toContain('Caught render error');
    });
  });
});
