/**
 * Utilities for Outage Duration calculation and CSV export.
 * Closes #471: Outages: Add outage duration live counter on active incident cards
 * Closes #476: Outages: Add export filtered outage list to CSV / Excel spreadsheet
 */



export interface OutageDurationResult {
  text: string;
  hours: number;
  minutes: number;
  totalMinutes: number;
  isOverFourHours: boolean;
}

/**
 * Calculates the elapsed time since detected_at and returns formatted live duration text.
 * Format: "Xh Ym ongoing" (e.g. '2h 15m ongoing') or "Ym ongoing" (e.g. '45m ongoing').
 * Applies isOverFourHours flag when duration exceeds 4 hours (240 minutes).
 */
export function formatOutageDuration(
  detectedAt: string | Date | null | undefined,
  currentDate: Date = new Date(),
): OutageDurationResult {
  if (!detectedAt) {
    return {
      text: "0m ongoing",
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      isOverFourHours: false,
    };
  }

  const startTime = new Date(detectedAt).getTime();
  const nowTime = currentDate.getTime();
  const elapsedMs = Math.max(0, nowTime - startTime);
  const totalMinutes = Math.floor(elapsedMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const text = hours > 0 ? `${hours}h ${minutes}m ongoing` : `${minutes}m ongoing`;
  const isOverFourHours = totalMinutes >= 240; // > 4 hours

  return {
    text,
    hours,
    minutes,
    totalMinutes,
    isOverFourHours,
  };
}

/**
 * Formats a list of outages into CSV string with exact columns:
 * Outage ID, Site, Severity, Status, Detected, Resolved, MTTR
 */
export function formatOutagesToCsv(outages: Array<Record<string, unknown>>): string {
  const headers = ["Outage ID", "Site", "Severity", "Status", "Detected", "Resolved", "MTTR"];

  const escapeField = (value: unknown): string => {
    if (value === null || value === undefined) return '""';
    const str = String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = outages.map((outage) => {
    const id = (outage.id as string) ?? "";
    const site = (outage.site_name as string) || (outage.site_id as string) || (outage.title as string) || "N/A";
    const severity = (outage.severity as string) || "N/A";
    const status = (outage.status as string) || "N/A";
    const detected = (outage.detected_at as string) || (outage.createdAt as string) || "N/A";
    const resolved = (outage.resolved_at as string) || "N/A";

    let mttr: string | number = "N/A";
    const slaStatus = outage.sla_status as { mttr_minutes?: number } | undefined;
    if (slaStatus?.mttr_minutes !== undefined && slaStatus.mttr_minutes !== null) {
      mttr = slaStatus.mttr_minutes;
    } else if (outage.mttr_minutes !== undefined && outage.mttr_minutes !== null) {
      mttr = outage.mttr_minutes as number;
    } else if (outage.resolved_at && outage.detected_at) {
      const diffMs = new Date(outage.resolved_at as string).getTime() - new Date(outage.detected_at as string).getTime();
      mttr = Math.max(0, Math.round(diffMs / (1000 * 60)));
    }

    return [
      escapeField(id),
      escapeField(site),
      escapeField(severity),
      escapeField(status),
      escapeField(detected),
      escapeField(resolved),
      escapeField(mttr),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Generates and triggers download of the outage list as CSV with filename outages-export-<date>.csv
 */
export function downloadOutagesCsv(
  outages: Array<Record<string, unknown>>,
  filename?: string,
): void {
  const dateStr = new Date().toISOString().split("T")[0];
  const targetFilename = filename || `outages-export-${dateStr}.csv`;
  const csvContent = formatOutagesToCsv(outages);

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = targetFilename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
