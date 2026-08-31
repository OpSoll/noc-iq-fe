import { z } from "zod";

/**
 * Schema for a single exported/imported preference payload.
 * Extend this as more preference categories are added to the app.
 */
export const preferenceSchema = z.object({
  accessibilityMode: z
    .enum(["default", "high-contrast", "reduced-motion"])
    .optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  notificationsEnabled: z.boolean().optional(),
  locale: z.string().min(2).max(10).optional(),
});

export type PreferencePayload = z.infer<typeof preferenceSchema>;

export interface PreferenceValidationError {
  key: string;
  message: string;
}

export interface PreferenceValidationResult {
  success: boolean;
  data: PreferencePayload | null;
  errors: PreferenceValidationError[];
}

/**
 * Validates a raw imported preference JSON string (or parsed object) against
 * the preference schema. Never throws — corrupted or invalid payloads are
 * reported as structured errors instead of crashing app store initialization.
 */
export function validatePreferenceImport(
  raw: string | unknown,
): PreferenceValidationResult {
  let parsed: unknown;

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        success: false,
        data: null,
        errors: [
          {
            key: "__root__",
            message: "File is not valid JSON and could not be parsed.",
          },
        ],
      };
    }
  } else {
    parsed = raw;
  }

  const result = preferenceSchema.safeParse(parsed);

  if (result.success) {
    return { success: true, data: result.data, errors: [] };
  }

  const errors: PreferenceValidationError[] = result.error.issues.map(
    (issue) => ({
      key: issue.path.length > 0 ? issue.path.join(".") : "__root__",
      message: issue.message,
    }),
  );

  return { success: false, data: null, errors };
}