"use client";

export type Capability =
  | "view:dashboard"
  | "view:outages"
  | "view:payments"
  | "view:settings"
  | "view:webhooks"
  | "view:config"
  | "view:bulk-import"
  | "action:create-outage"
  | "action:resolve-outage"
  | "action:delete-outage"
  | "action:manage-webhooks"
  | "action:manage-config"
  | "action:export-data"
  | "action:manage-wallet";

export type Role = "admin" | "engineer" | "viewer" | "operator";

export type CapabilityMode = "baseline" | "degraded" | "restricted";

export const ROLE_CAPABILITY_MATRIX: Record<Role, Capability[]> = {
  admin: [
    "view:dashboard",
    "view:outages",
    "view:payments",
    "view:settings",
    "view:webhooks",
    "view:config",
    "view:bulk-import",
    "action:create-outage",
    "action:resolve-outage",
    "action:delete-outage",
    "action:manage-webhooks",
    "action:manage-config",
    "action:export-data",
    "action:manage-wallet",
  ],
  engineer: [
    "view:dashboard",
    "view:outages",
    "view:payments",
    "view:settings",
    "view:bulk-import",
    "action:create-outage",
    "action:resolve-outage",
    "action:export-data",
    "action:manage-wallet",
  ],
  operator: [
    "view:dashboard",
    "view:outages",
    "view:settings",
    "action:create-outage",
    "action:resolve-outage",
  ],
  viewer: [
    "view:dashboard",
    "view:outages",
    "view:payments",
    "view:settings",
  ],
};

export const ROUTE_CAPABILITY_MAP: Record<string, Capability> = {
  "/": "view:dashboard",
  "/outages": "view:outages",
  "/outages/new": "action:create-outage",
  "/payments": "view:payments",
  "/setting": "view:settings",
  "/webhooks": "view:webhooks",
  "/config": "view:config",
  "/bulk-import": "view:bulk-import",
  "/admin": "view:config",
};

export const MODE_RESTRICTIONS: Record<CapabilityMode, Capability[]> = {
  baseline: Object.values(ROLE_CAPABILITY_MATRIX).flat(),
  degraded: [
    "view:dashboard",
    "view:outages",
    "view:payments",
    "view:settings",
    "view:bulk-import",
    "action:resolve-outage",
    "action:export-data",
  ],
  restricted: [
    "view:dashboard",
    "view:outages",
  ],
};

export function getCapabilitiesForRole(role: string | null | undefined): Capability[] {
  if (!role) return [];
  return ROLE_CAPABILITY_MATRIX[role as Role] ?? ROLE_CAPABILITY_MATRIX.viewer;
}

export function hasCapability(
  role: string | null | undefined,
  capability: Capability,
  mode?: CapabilityMode,
): boolean {
  const roleCaps = getCapabilitiesForRole(role);
  if (!roleCaps.includes(capability)) return false;
  if (mode) {
    return MODE_RESTRICTIONS[mode]?.includes(capability) ?? true;
  }
  return true;
}

export function getCapabilityForPath(path: string): Capability | null {
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  for (const [route, cap] of Object.entries(ROUTE_CAPABILITY_MAP)) {
    if (normalized === route || normalized.startsWith(route + "/")) {
      return cap;
    }
  }
  return null;
}

export function getModeFromBackend(): CapabilityMode {
  if (typeof window === "undefined") return "baseline";
  const mode = localStorage.getItem("noc_capability_mode") as CapabilityMode | null;
  return mode ?? "baseline";
}
