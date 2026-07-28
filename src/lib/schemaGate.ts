export interface ChartConfig {
  dimensions?: string[];
  measures?: string[];
  type?: string;
  [key: string]: unknown;
}

export interface SchemaGateResult {
  valid: boolean;
  errors: string[];
}

export function validateChartConfig(config: ChartConfig): SchemaGateResult {
  const errors: string[] = [];
  if (!config.dimensions || config.dimensions.length === 0) {
    errors.push("Chart config must include at least one dimension");
  }
  if (!config.measures || config.measures.length === 0) {
    errors.push("Chart config must include at least one measure");
  }
  if (!config.type) {
    errors.push("Chart config must specify a chart type");
  }
  return { valid: errors.length === 0, errors };
}
