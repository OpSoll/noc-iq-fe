import { z } from "zod";

export const OutageFormSchema = z.object({
  serviceId: z
    .string()
    .min(1, "Service is required"),

  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(
      200,
      "Title must be 200 characters or fewer",
    ),

  description: z
    .string()
    .trim()
    .min(
      1,
      "Description is required",
    ),

  severity: z.enum([
    "low",
    "medium",
    "high",
    "critical",
  ]),

  startedAt: z.coerce.date({
    message: "A valid start time is required",
  }),

  resolvedAt: z
    .coerce
    .date()
    .optional()
    .nullable(),
});

export type OutageFormValues = z.infer<
  typeof OutageFormSchema
>;