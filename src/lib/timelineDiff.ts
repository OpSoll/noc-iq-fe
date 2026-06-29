export type FieldMutation = {
  field: string;
  before: unknown;
  after: unknown;
};

export type TimelineDiff = {
  entryId: string;
  timestamp: string;
  mutations: FieldMutation[];
  hasChanges: boolean;
};

export function computeDiff(before: Record<string, unknown>, after: Record<string, unknown>): FieldMutation[] {
  const mutations: FieldMutation[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      mutations.push({ field: key, before: before[key], after: after[key] });
    }
  }
  return mutations;
}

export function buildTimelineDiff(entryId: string, timestamp: string, before: Record<string, unknown>, after: Record<string, unknown>): TimelineDiff {
  const mutations = computeDiff(before, after);
  return { entryId, timestamp, mutations, hasChanges: mutations.length > 0 };
}

export function formatMutation(mutation: FieldMutation): string {
  return `${mutation.field}: "${String(mutation.before)}" → "${String(mutation.after)}"`;
}

export function diffModeSummary(diffs: TimelineDiff[]): { totalChanges: number; fieldsAffected: string[] } {
  const fields = new Set<string>();
  let count = 0;
  for (const diff of diffs) {
    for (const m of diff.mutations) {
      fields.add(m.field);
      count++;
    }
  }
  return { totalChanges: count, fieldsAffected: Array.from(fields) };
}
