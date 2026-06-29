export type ValidationRule = {
  path: string;
  type: "string" | "number" | "boolean" | "array" | "object" | "nullableString" | "isoDate";
  required?: boolean;
};

export type ValidationResult = {
  valid: boolean;
  errors: { path: string; message: string }[];
};

function getValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function checkType(value: unknown, type: string): boolean {
  if (type === "nullableString") return value === null || typeof value === "string";
  if (type === "isoDate") return typeof value === "string" && !isNaN(Date.parse(value));
  if (type === "array") return Array.isArray(value);
  return typeof value === type;
}

export function validateResponseShape(data: Record<string, unknown>, rules: ValidationRule[]): ValidationResult {
  const errors: { path: string; message: string }[] = [];
  for (const rule of rules) {
    const value = getValue(data, rule.path);
    const exists = value !== undefined;
    if (rule.required && !exists) {
      errors.push({ path: rule.path, message: `missing required field` });
      continue;
    }
    if (exists && !checkType(value, rule.type)) {
      errors.push({ path: rule.path, message: `expected ${rule.type}, got ${typeof value}` });
    }
  }
  return { valid: errors.length === 0, errors };
}

export function bridgeHighRiskPayload(payload: Record<string, unknown>, rules: ValidationRule[]): { sanitized: Record<string, unknown>; warnings: string[] } {
  const validation = validateResponseShape(payload, rules);
  const warnings = validation.errors.map((e) => `PAYLOAD_WARNING: ${e.path} — ${e.message}`);
  return { sanitized: { ...payload, _validated: validation.valid }, warnings };
}
