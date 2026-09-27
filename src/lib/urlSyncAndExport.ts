// Closes #343: URL-synced panel state for deep-linkable views
// Closes #344: CSV export for outages and payments tables
// Closes #617: shared text/JSON downloader behind downloadCsv + downloadJson

export function getPanelIdFromUrl(search: string, param = 'id'): string | null {
  return new URLSearchParams(search).get(param);
}

export function withPanelId(
  pathname: string,
  search: string,
  id: string | null,
  param = 'id'
): string {
  const params = new URLSearchParams(search);
  if (id) params.set(param, id);
  else params.delete(param);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ];
  return lines.join('\n');
}

export function downloadText(
  filename: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8;'
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(
  filename: string,
  rows: Record<string, unknown>[]
): void {
  downloadText(filename, toCsv(rows), 'text/csv;charset=utf-8;');
}

export function downloadJson(filename: string, data: unknown): void {
  downloadText(
    filename,
    JSON.stringify(data, null, 2),
    'application/json;charset=utf-8;'
  );
}
