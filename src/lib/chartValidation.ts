export interface ChartSchema {
  requiredFields: string[];
  numericFields?: string[];
  arrayFields?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized: Record<string, unknown>[];
}

export function validateChartData(
  data: unknown[],
  schema: ChartSchema
): ValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(data) || data.length === 0) {
    return { valid: false, errors: ["Data is empty or not an array"], sanitized: [] };
  }
  const sanitized = data.filter((item, idx) => {
    if (!item || typeof item !== "object") {
      errors.push(`Item at index ${idx} is not an object`);
      return false;
    }
    const obj = item as Record<string, unknown>;
    for (const field of schema.requiredFields) {
      if (obj[field] === undefined || obj[field] === null) {
        errors.push(`Missing required field "${field}" at index ${idx}`);
        return false;
      }
    }
    if (schema.numericFields) {
      for (const field of schema.numericFields) {
        if (obj[field] !== undefined && typeof obj[field] !== "number") {
          errors.push(`Field "${field}" at index ${idx} is not a number`);
          return false;
        }
      }
    }
    return true;
  });
  return { valid: errors.length === 0, errors, sanitized };
}
