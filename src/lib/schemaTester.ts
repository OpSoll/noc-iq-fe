export type SchemaField = {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object" | "null";
  required: boolean;
  description?: string;
};

export type SchemaTestResult = {
  field: string;
  passed: boolean;
  expectedType: string;
  actualType: string;
  error?: string;
};

export type SchemaCompatibilitySummary = {
  totalFields: number;
  passed: number;
  failed: number;
  results: SchemaTestResult[];
};

export function testPayloadAgainstSchema(payload: Record<string, unknown>, schema: SchemaField[]): SchemaCompatibilitySummary {
  const results: SchemaTestResult[] = [];

  for (const field of schema) {
    const value = payload[field.name];
    const actualType = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
    const passed = !field.required || (value !== undefined && actualType === field.type);
    results.push({
      field: field.name,
      passed,
      expectedType: field.type,
      actualType: value === undefined ? "undefined" : actualType,
      error: field.required && value === undefined ? "Missing required field" : passed ? undefined : `Expected ${field.type}, got ${actualType}`,
    });
  }

  return {
    totalFields: schema.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}

export function formatSchemaTestResult(summary: SchemaCompatibilitySummary): string {
  return `Schema test: ${summary.passed}/${summary.totalFields} passed (${summary.failed} failed)`;
}

export function getFailedFields(summary: SchemaCompatibilitySummary): SchemaTestResult[] {
  return summary.results.filter((r) => !r.passed);
}
