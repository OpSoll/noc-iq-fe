/**
 * Browser performance monitoring — long-task and INP metrics.
 * Non-blocking; fails silently in production.
 */

export interface LongTaskEntry {
  duration: number;
  startTime: number;
  name: string;
}

export interface INPMetric {
  interactionType: string;
  duration: number;
  startTime: number;
}

export interface PerformanceMetrics {
  longTasks: LongTaskEntry[];
  inp: INPMetric[];
}

const LONG_TASK_THRESHOLD_MS = 50;
const SAMPLE_RATE = 10;

let longTasks: LongTaskEntry[] = [];
let inpMetrics: INPMetric[] = [];
let observer: PerformanceObserver | null = null;
let inpObserver: PerformanceObserver | null = null;
let sampleCounter = 0;

export function getPerformanceMetrics(): PerformanceMetrics {
  return { longTasks: [...longTasks], inp: [...inpMetrics] };
}

export function clearPerformanceMetrics(): void {
  longTasks = [];
  inpMetrics = [];
}

export function disconnectObservers(): void {
  observer?.disconnect();
  observer = null;
  inpObserver?.disconnect();
  inpObserver = null;
}

let onLongTaskCallback: ((entry: LongTaskEntry) => void) | null = null;

export function onLongTask(fn: (entry: LongTaskEntry) => void): void {
  onLongTaskCallback = fn;
}

export function resetOnLongTaskCallback(): void {
  onLongTaskCallback = null;
}

export function observeLongTasks(): void {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;

  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        sampleCounter++;
        if (sampleCounter % SAMPLE_RATE !== 0) continue;

        const lt: LongTaskEntry = {
          duration: entry.duration,
          startTime: entry.startTime,
          name: entry.name,
        };
        longTasks.push(lt);
        if (longTasks.length > 200) longTasks.shift();

        try {
          onLongTaskCallback?.(lt);
        } catch {
          // silent
        }
      }
    });
    observer.observe({ type: "longtask", buffered: false });
  } catch {
    // Long task observer not supported
  }
}

export function observeINP(): void {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;

  try {
    inpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration < LONG_TASK_THRESHOLD_MS) continue;

        const metric: INPMetric = {
          interactionType: entry.name,
          duration: entry.duration,
          startTime: entry.startTime,
        };
        inpMetrics.push(metric);
        if (inpMetrics.length > 100) inpMetrics.shift();
      }
    });
    inpObserver.observe({ type: "event", buffered: false });
  } catch {
    // Event observer not supported
  }
}

const MONITORED_ROUTES = new Set(["/dashboard", "/outages", "/payments", "/webhooks"]);

export function isMonitoredRoute(route: string): boolean {
  return MONITORED_ROUTES.has(route);
}

export function initPerformanceMonitoring(route: string): void {
  if (!isMonitoredRoute(route)) return;
  disconnectObservers();
  clearPerformanceMetrics();
  observeLongTasks();
  observeINP();
}

export function stopPerformanceMonitoring(): void {
  disconnectObservers();
}
