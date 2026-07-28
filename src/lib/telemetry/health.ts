export type TelemetryHealthState = "normal" | "degraded" | "disabled";

export interface TelemetryMetrics {
  totalEmitted: number;
  totalDropped: number;
  dropRate: number;
  uptimeMs: number;
}

const DEGRADED_THRESHOLD = 0.05;
const WINDOW_SIZE = 100;

export class TelemetryHealthManager {
  private state: TelemetryHealthState = "normal";
  private emitted = 0;
  private dropped = 0;
  private window: boolean[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  getState(): TelemetryHealthState {
    if (this.state === "disabled") return "disabled";
    if (this.window.length >= WINDOW_SIZE) {
      const dropRate = this.window.filter((d) => d).length / this.window.length;
      if (dropRate > DEGRADED_THRESHOLD) {
        this.state = "degraded";
      } else {
        this.state = "normal";
      }
    }
    return this.state;
  }

  recordEmit(): void {
    if (this.state === "disabled") return;
    this.emitted++;
    this.window.push(false);
    if (this.window.length > WINDOW_SIZE) {
      this.window.shift();
    }
  }

  recordDrop(): void {
    if (this.state === "disabled") return;
    this.dropped++;
    this.window.push(true);
    if (this.window.length > WINDOW_SIZE) {
      this.window.shift();
    }
  }

  disable(): void {
    this.state = "disabled";
  }

  enable(): void {
    this.state = "normal";
  }

  getMetrics(): TelemetryMetrics {
    const total = this.emitted + this.dropped;
    return {
      totalEmitted: this.emitted,
      totalDropped: this.dropped,
      dropRate: total > 0 ? this.dropped / total : 0,
      uptimeMs: Date.now() - this.startTime,
    };
  }

  reset(): void {
    this.state = "normal";
    this.emitted = 0;
    this.dropped = 0;
    this.window = [];
    this.startTime = Date.now();
  }
}
