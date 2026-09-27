/**
 * Canonical catalog of webhook event topics and their JSON Schemas.
 *
 * Developers writing a receiver currently have to guess the payload shape.
 * Keeping the schemas in the frontend means the reference is versioned
 * alongside the code that emits the events, so a schema and its producer
 * cannot drift apart the way a separate docs page does.
 *
 * Closes #669 — topic subscription selector checklist.
 * Closes #670 — webhook payload JSON schema viewer modal.
 */

export interface WebhookEventDefinition {
  /** Topic string subscribed to, e.g. `outage.created`. */
  topic: string;
  /** Human label for the checklist and schema tabs. */
  label: string;
  /** What the event means, shown as a tooltip in the checklist. */
  description: string;
  /** JSON Schema (draft 2020-12) describing the delivered payload. */
  schema: Record<string, unknown>;
  /** A realistic example payload. */
  example: Record<string, unknown>;
}

const stringProp = (description: string) => ({
  type: 'string',
  description,
});

const isoDate = stringProp('RFC 3339 / ISO 8601 timestamp');

const envelopeProperties = {
  event: stringProp('Event topic that triggered this delivery'),
  delivery_id: stringProp('Unique identifier for this delivery attempt'),
  occurred_at: isoDate,
};

const envelopeRequired = ['event', 'delivery_id', 'occurred_at'];

const envelope = (
  topic: string,
  properties: Record<string, unknown>,
  required: string[]
) => ({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `https://noc-iq.dev/schemas/webhooks/${topic}.json`,
  title: `${topic} event`,
  description: `Payload delivered to a webhook endpoint subscribed to ${topic}.`,
  type: 'object',
  additionalProperties: false,
  properties: {
    ...envelopeProperties,
    ...properties,
  },
  required: [...envelopeRequired, ...required],
});

/** Every event topic the platform can deliver, in display order. */
export const WEBHOOK_EVENTS: readonly WebhookEventDefinition[] = [
  {
    topic: 'outage.created',
    label: 'Outage created',
    description:
      'A new outage was logged against a site. Fires once, when the incident is first recorded.',
    schema: envelope(
      'outage.created',
      {
        outage_id: stringProp('Identifier of the newly created outage'),
        site_id: stringProp('Site the outage affects'),
        severity: {
          type: 'string',
          enum: ['minor', 'major', 'critical'],
          description: 'Operational severity assigned at creation',
        },
        description: stringProp('Free-text operator summary'),
      },
      ['outage_id', 'site_id', 'severity']
    ),
    example: {
      event: 'outage.created',
      delivery_id: 'dlv_01H8XQ2W7Z',
      occurred_at: '2026-01-15T10:30:00.000Z',
      outage_id: 'out_4821',
      site_id: 'LHR-04',
      severity: 'major',
      description: 'Uplink degraded after fibre cut on A303.',
    },
  },
  {
    topic: 'outage.resolved',
    label: 'Outage resolved',
    description:
      'An outage was marked resolved. The payload carries how long the incident lasted.',
    schema: envelope(
      'outage.resolved',
      {
        outage_id: stringProp('Identifier of the resolved outage'),
        site_id: stringProp('Site the outage affected'),
        resolved_by: stringProp('Operator who resolved the outage'),
        duration_minutes: {
          type: 'integer',
          minimum: 0,
          description: 'Elapsed minutes between creation and resolution',
        },
        resolution_notes: stringProp('Post-resolution summary'),
      },
      ['outage_id', 'site_id', 'duration_minutes']
    ),
    example: {
      event: 'outage.resolved',
      delivery_id: 'dlv_01H8XQ9M2C',
      occurred_at: '2026-01-15T12:45:00.000Z',
      outage_id: 'out_4821',
      site_id: 'LHR-04',
      resolved_by: 'a.ahmad',
      duration_minutes: 135,
      resolution_notes: 'Fibre splice completed, uplink stable for 30 minutes.',
    },
  },
  {
    topic: 'sla.breached',
    label: 'SLA breached',
    description:
      'An availability or response-time SLA was missed for a site during the current window.',
    schema: envelope(
      'sla.breached',
      {
        outage_id: stringProp('Outage that caused the breach, when attributable'),
        site_id: stringProp('Site whose SLA was breached'),
        sla_target_percent: {
          type: 'number',
          description: 'Contractual availability target, e.g. 99.9',
        },
        measured_percent: {
          type: 'number',
          description: 'Availability actually measured for the window',
        },
        penalty_amount: stringProp('Penalty owed, as a decimal string'),
        penalty_asset: stringProp('Stellar asset code of the penalty, e.g. USDC'),
      },
      ['site_id', 'sla_target_percent', 'measured_percent', 'penalty_amount']
    ),
    example: {
      event: 'sla.breached',
      delivery_id: 'dlv_01H8XQA7K4',
      occurred_at: '2026-01-15T23:59:59.000Z',
      outage_id: 'out_4821',
      site_id: 'LHR-04',
      sla_target_percent: 99.9,
      measured_percent: 99.42,
      penalty_amount: '1450.00',
      penalty_asset: 'USDC',
    },
  },
  {
    topic: 'payment.processed',
    label: 'Payment processed',
    description:
      'A disbursement was settled on-chain. `transaction_hash` may be null until confirmation.',
    schema: envelope(
      'payment.processed',
      {
        payment_id: stringProp('Platform payment identifier'),
        to_address: stringProp('Recipient Stellar account ID'),
        amount: stringProp('Amount sent, as a decimal string'),
        asset_code: stringProp('Stellar asset code, e.g. USDC or XLM'),
        transaction_hash: {
          type: ['string', 'null'],
          pattern: '^[0-9a-fA-F]{64}$',
          description: 'On-chain transaction hash; null while pending',
        },
        status: {
          type: 'string',
          enum: ['pending', 'completed', 'failed'],
          description: 'Settlement status at the time of the event',
        },
      },
      ['payment_id', 'to_address', 'amount', 'asset_code', 'status']
    ),
    example: {
      event: 'payment.processed',
      delivery_id: 'dlv_01H8XQK5B1',
      occurred_at: '2026-01-15T14:02:11.000Z',
      payment_id: 'pay_77310',
      to_address:
        'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBH',
      amount: '1450.00',
      asset_code: 'USDC',
      transaction_hash: 'c'.repeat(64),
      status: 'completed',
    },
  },
  {
    topic: 'dispute.opened',
    label: 'Dispute opened',
    description:
      'An SLA penalty was disputed. Receivers should expect a later resolution event.',
    schema: envelope(
      'dispute.opened',
      {
        dispute_id: stringProp('Dispute identifier'),
        payment_id: stringProp('Disputed payment identifier'),
        site_id: stringProp('Site the disputed outage affected'),
        reason: stringProp('Grounds for the dispute'),
        opened_by: stringProp('Operator or partner who opened the dispute'),
      },
      ['dispute_id', 'payment_id', 'site_id', 'reason']
    ),
    example: {
      event: 'dispute.opened',
      delivery_id: 'dlv_01H8XQQ9D3',
      occurred_at: '2026-01-16T08:05:00.000Z',
      dispute_id: 'dsp_0091',
      payment_id: 'pay_77310',
      site_id: 'LHR-04',
      reason: 'Maintenance window overlapped the reported outage.',
      opened_by: 'partner.northlink',
    },
  },
  {
    topic: 'dispute.resolved',
    label: 'Dispute resolved',
    description:
      'A dispute was decided. `outcome` is the authoritative result of the arbitration.',
    schema: envelope(
      'dispute.resolved',
      {
        dispute_id: stringProp('Dispute identifier'),
        payment_id: stringProp('Disputed payment identifier'),
        outcome: {
          type: 'string',
          enum: ['upheld', 'overturned', 'split'],
          description: 'Arbitration decision',
        },
        resolved_by: stringProp('Arbitrator who issued the decision'),
        refund_amount: stringProp('Amount refunded when overturned or split'),
      },
      ['dispute_id', 'payment_id', 'outcome']
    ),
    example: {
      event: 'dispute.resolved',
      delivery_id: 'dlv_01H8XQV3F8',
      occurred_at: '2026-01-17T16:40:00.000Z',
      dispute_id: 'dsp_0091',
      payment_id: 'pay_77310',
      outcome: 'upheld',
      resolved_by: 'admin.rk',
      refund_amount: '0.00',
    },
  },
] as const;

export const WEBHOOK_TOPICS: readonly string[] = WEBHOOK_EVENTS.map(
  (event) => event.topic
);

export function getEventDefinition(topic: string) {
  return WEBHOOK_EVENTS.find((event) => event.topic === topic) ?? null;
}

/** Strips unknown topics, de-duplicates, and returns canonical ordering. */
export function normalizeTopics(topics: readonly string[] | null | undefined): string[] {
  if (!topics) return [];
  const requested = new Set(topics);
  return WEBHOOK_TOPICS.filter((topic) => requested.has(topic));
}

/** Topics in `selected` that the platform does not recognise. */
export function findUnknownTopics(
  topics: readonly string[] | null | undefined
): string[] {
  if (!topics) return [];
  const known = new Set(WEBHOOK_TOPICS);
  return topics.filter((topic) => !known.has(topic));
}

/** Serialises a schema for display, preserving key order. */
export function formatSchema(schema: Record<string, unknown>): string {
  return JSON.stringify(schema, null, 2);
}

export function formatExample(example: Record<string, unknown>): string {
  return JSON.stringify(example, null, 2);
}
