import { describe, it, expect } from 'vitest';

import {
  findUnknownTopics,
  formatExample,
  formatSchema,
  getEventDefinition,
  normalizeTopics,
  WEBHOOK_EVENTS,
  WEBHOOK_TOPICS,
} from '@/lib/webhookEvents';

describe('WEBHOOK_EVENTS catalog', () => {
  it('lists the event topics the issue names', () => {
    expect(WEBHOOK_TOPICS).toContain('outage.created');
    expect(WEBHOOK_TOPICS).toContain('outage.resolved');
    expect(WEBHOOK_TOPICS).toContain('sla.breached');
  });

  it('gives every event a label, description, schema, and example', () => {
    for (const event of WEBHOOK_EVENTS) {
      expect(event.topic).toMatch(/^[a-z_]+\.[a-z_]+$/);
      expect(event.label.length).toBeGreaterThan(0);
      expect(event.description.length).toBeGreaterThan(20);
      expect(event.example.event).toBe(event.topic);
    }
  });

  it('has no duplicate topics', () => {
    expect(new Set(WEBHOOK_TOPICS).size).toBe(WEBHOOK_TOPICS.length);
  });

  it('resolves an event by topic', () => {
    expect(getEventDefinition('outage.created')?.label).toBe('Outage created');
    expect(getEventDefinition('nope.nope')).toBeNull();
  });
});

describe('event schemas', () => {
  it('declares a JSON Schema 2020-12 envelope for every event', () => {
    for (const event of WEBHOOK_EVENTS) {
      const schema = event.schema as Record<string, any>;
      expect(schema.$schema).toBe(
        'https://json-schema.org/draft/2020-12/schema'
      );
      expect(schema.type).toBe('object');
      expect(schema.$id).toContain(event.topic);
    }
  });

  it('requires the shared envelope fields on every event', () => {
    for (const event of WEBHOOK_EVENTS) {
      const schema = event.schema as Record<string, any>;
      expect(schema.required).toEqual(
        expect.arrayContaining(['event', 'delivery_id', 'occurred_at'])
      );
      expect(schema.properties.event).toBeDefined();
      expect(schema.properties.occurred_at.description).toMatch(/RFC 3339/);
    }
  });

  it('documents every property', () => {
    for (const event of WEBHOOK_EVENTS) {
      const schema = event.schema as Record<string, any>;
      for (const [name, prop] of Object.entries(schema.properties)) {
        expect(
          (prop as any).description,
          `${event.topic}.${name} needs a description`
        ).toBeTruthy();
      }
    }
  });

  it('constrains severity and payment status to known values', () => {
    const outage = getEventDefinition('outage.created')!.schema as any;
    expect(outage.properties.severity.enum).toEqual([
      'minor',
      'major',
      'critical',
    ]);

    const payment = getEventDefinition('payment.processed')!.schema as any;
    expect(payment.properties.status.enum).toEqual([
      'pending',
      'completed',
      'failed',
    ]);
  });

  it('allows a null transaction hash while a payment is pending', () => {
    const schema = getEventDefinition('payment.processed')!.schema as any;
    expect(schema.properties.transaction_hash.type).toEqual(['string', 'null']);
    expect(schema.properties.transaction_hash.pattern).toBe('^[0-9a-fA-F]{64}$');
  });

  it('includes the extra fields required by the outage.resolved issue', () => {
    const schema = getEventDefinition('outage.resolved')!.schema as any;
    expect(schema.properties.duration_minutes).toBeDefined();
    expect(schema.required).toEqual(
      expect.arrayContaining(['outage_id', 'site_id', 'duration_minutes'])
    );
  });
});

describe('normalizeTopics', () => {
  it('keeps only canonical topics, in catalog order', () => {
    expect(normalizeTopics(['sla.breached', 'outage.created'])).toEqual([
      'outage.created',
      'sla.breached',
    ]);
  });

  it('drops unknown topics', () => {
    expect(normalizeTopics(['outage.created', 'made.up'])).toEqual([
      'outage.created',
    ]);
  });

  it('de-duplicates', () => {
    expect(normalizeTopics(['outage.created', 'outage.created'])).toEqual([
      'outage.created',
    ]);
  });

  it('handles empty and nullish input', () => {
    expect(normalizeTopics([])).toEqual([]);
    expect(normalizeTopics(null)).toEqual([]);
    expect(normalizeTopics(undefined)).toEqual([]);
  });
});

describe('findUnknownTopics', () => {
  it('reports topics the platform does not recognise', () => {
    expect(findUnknownTopics(['outage.created', 'made.up', 'also.fake'])).toEqual([
      'made.up',
      'also.fake',
    ]);
  });

  it('reports nothing for a clean list', () => {
    expect(findUnknownTopics(WEBHOOK_TOPICS)).toEqual([]);
  });

  it('handles nullish input', () => {
    expect(findUnknownTopics(null)).toEqual([]);
  });
});

describe('formatters', () => {
  it('pretty-prints a schema as indented JSON', () => {
    const json = formatSchema({ a: 1 });
    expect(json).toContain('\n');
    expect(json).toBe('{\n  "a": 1\n}');
  });

  it('pretty-prints an example as indented JSON', () => {
    expect(formatExample({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});
