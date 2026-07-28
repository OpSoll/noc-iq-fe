// Closes #343: URL-synced panel state for deep-linkable views
// Closes #344: CSV export for outages and payments tables

export function getPanelIdFromUrl(search: string, param = "id"): string | null {
  return new URLSearchParams(search).get(param);
}

export function withPanelId(pathname: string, search: string, id: string | null, param = "id"): string {
  const params = new URLSearchParams(search);
  if (id) params.set(param, id);
  else params.delete(param);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
