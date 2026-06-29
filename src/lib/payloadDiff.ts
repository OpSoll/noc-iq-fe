export type PayloadVersion = {
  attempt: number;
  timestamp: string;
  payload: Record<string, unknown>;
  statusCode: number;
};

export type PayloadDiff = {
  field: string;
  from: unknown;
  to: unknown;
  changed: boolean;
};

export function diffPayloads(before: Record<string, unknown>, after: Record<string, unknown>): PayloadDiff[] {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs: PayloadDiff[] = [];
  for (const key of allKeys) {
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      diffs.push({ field: key, from, to, changed: true });
    }
  }
  return diffs;
}

export function buildVersionTimeline(versions: PayloadVersion[]): { versions: PayloadVersion[]; changes: PayloadDiff[][] } {
  const changes: PayloadDiff[][] = [];
  for (let i = 1; i < versions.length; i++) {
    changes.push(diffPayloads(versions[i - 1].payload, versions[i].payload));
  }
  return { versions, changes };
}

export function renderPayloadDiff(diffs: PayloadDiff[]): string {
  return diffs.map((d) => `${d.field}: ${JSON.stringify(d.from)} → ${JSON.stringify(d.to)}`).join("\n");
}
