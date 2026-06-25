import { describe, it, expect } from "vitest";
import {
  ROLE_CAPABILITY_MATRIX,
  ROUTE_CAPABILITY_MAP,
  MODE_RESTRICTIONS,
  hasCapability,
  getCapabilityForPath,
} from "@/services/capabilities";

const ROLES = Object.keys(ROLE_CAPABILITY_MATRIX);
const MODES = Object.keys(MODE_RESTRICTIONS) as Array<keyof typeof MODE_RESTRICTIONS>;
const ROUTES = Object.keys(ROUTE_CAPABILITY_MAP);

describe("Route Smoke Matrix", () => {
  ROUTES.forEach((route) => {
    const capability = ROUTE_CAPABILITY_MAP[route];

    it(`route ${route} requires capability ${capability}`, () => {
      expect(capability).toBeTruthy();
    });

    ROLES.forEach((role) => {
      MODES.forEach((mode) => {
        const allowed = hasCapability(role, capability, mode);
        const modeCaps = MODE_RESTRICTIONS[mode];
        const modeAllows = modeCaps.includes(capability);
        const roleAllows = ROLE_CAPABILITY_MATRIX[role as keyof typeof ROLE_CAPABILITY_MATRIX].includes(capability);

        it(`[${mode}] ${role} → ${route} (${capability}) = ${allowed}`, () => {
          if (!roleAllows) {
            expect(allowed).toBe(false);
          } else if (!modeAllows) {
            expect(allowed).toBe(false);
          } else {
            expect(allowed).toBe(true);
          }
        });
      });
    });
  });

  it("admin has all capabilities in baseline mode", () => {
    const allCaps = Object.values(ROUTE_CAPABILITY_MAP);
    allCaps.forEach((cap) => {
      expect(hasCapability("admin", cap, "baseline")).toBe(true);
    });
  });

  it("restricted mode only allows view:dashboard and view:outages", () => {
    expect(hasCapability("admin", "view:payments", "restricted")).toBe(false);
    expect(hasCapability("admin", "action:resolve-outage", "restricted")).toBe(false);
  });
});
