export type ScaleType = "linear" | "log" | "percentage";
export type MeasureType = "currency" | "count" | "percentage" | "duration" | "ratio";

export interface AxisConfig {
  label: string;
  unit?: string;
  scale: ScaleType;
  measure: MeasureType;
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: "warning" | "error";
}

const COMPATIBLE_MEASURES: Record<ScaleType, MeasureType[]> = {
  linear: ["currency", "count", "duration", "ratio", "percentage"],
  log: ["currency", "count", "duration", "ratio"],
  percentage: ["percentage"],
};

const MISLEADING_COMBINATIONS: Array<{
  check: (axes: AxisConfig[]) => ValidationWarning | null;
}> = [
  {
    check: (axes) => {
      const hasMixed = axes.some((a) => a.measure === "currency") &&
        axes.some((a) => a.measure === "percentage");
      if (hasMixed) {
        return {
          field: "axis-measures",
          message: "Mixing currency and percentage measures on the same chart can be misleading",
          severity: "warning",
        };
      }
      return null;
    },
  },
  {
    check: (axes) => {
      const hasLogWithZero = axes.some((a) => a.scale === "log");
      if (hasLogWithZero) {
        return {
          field: "scale-log",
          message: "Log scale cannot display zero or negative values",
          severity: "warning",
        };
      }
      return null;
    },
  },
  {
    check: (axes) => {
      const missingUnits = axes.filter((a) => !a.unit && a.measure !== "count" && a.measure !== "ratio");
      if (missingUnits.length > 0) {
        return {
          field: "missing-units",
          message: `Axis "${missingUnits.map((a) => a.label).join(", ")}" has no unit specified`,
          severity: "warning",
        };
      }
      return null;
    },
  },
];

export function validateAxisConfig(axes: AxisConfig[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const axis of axes) {
    const allowed = COMPATIBLE_MEASURES[axis.scale];
    if (allowed && !allowed.includes(axis.measure)) {
      warnings.push({
        field: `${axis.label}.measure`,
        message: `Measure "${axis.measure}" is not compatible with ${axis.scale} scale`,
        severity: "error",
      });
    }
  }

  for (const rule of MISLEADING_COMBINATIONS) {
    const warning = rule.check(axes);
    if (warning) warnings.push(warning);
  }

  return warnings;
}

export function isChartMisleading(axes: AxisConfig[]): boolean {
  return validateAxisConfig(axes).some((w) => w.severity === "error");
}

export function getChartWarnings(axes: AxisConfig[]): string[] {
  return validateAxisConfig(axes).map((w) => w.message);
}
