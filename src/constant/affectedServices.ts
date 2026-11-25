
export const STANDARD_AFFECTED_SERVICES = [
  "Voice",
  "Data",
  "Backhaul",
  "Fiber",
] as const;

export type StandardAffectedService =
  (typeof STANDARD_AFFECTED_SERVICES)[number];

export type AffectedService = string;

export const SERVICE_COLORS: Record<string, string> = {
  Voice: "bg-violet-100 text-violet-800 border-violet-200",
  Data: "bg-blue-100 text-blue-800 border-blue-200",
  Backhaul: "bg-amber-100 text-amber-800 border-amber-200",
  Fiber: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export function normalizeServiceTag(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function addUniqueService(
  services: string[],
  candidate: string,
): string[] {
  const normalized = normalizeServiceTag(candidate);

  if (!normalized) return services;

  const exists = services.some(
    (service) => service.toLowerCase() === normalized.toLowerCase(),
  );

  return exists ? services : [...services, normalized];
}

export function getServiceColor(service: string): string {
  return (
    SERVICE_COLORS[service] ??
    "bg-gray-100 text-gray-800 border-gray-200"
  );
}
