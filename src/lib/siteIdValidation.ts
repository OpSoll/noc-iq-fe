export const SITE_ID_PATTERN = /^[a-zA-Z0-9\-]+$/;
export const SITE_ID_ERROR =
  "Site ID may only contain letters, numbers, and hyphens";

export function validateSiteId(value: string): string | null {
  if (value.length === 0 || SITE_ID_PATTERN.test(value)) return null;
  return SITE_ID_ERROR;
}