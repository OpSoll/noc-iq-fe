"use client";

import { useState } from "react";

type Signal = "pass" | "warn" | "fail" | "unknown";

interface DomainRow {
  domain: string;
  routes: string;
  testHealth: Signal;
  reliabilityScore: Signal;
  accessibility: Signal;
  issueStatus: string;
}

const DOMAINS: DomainRow[] = [
  { domain: "Auth", routes: "/login, /register", testHealth: "pass", reliabilityScore: "pass", accessibility: "pass", issueStatus: "Tracked" },
  { domain: "Outages", routes: "/outages, /outages/[id]", testHealth: "pass", reliabilityScore: "pass", accessibility: "warn", issueStatus: "Tracked" },
  { domain: "Payments", routes: "/payments", testHealth: "pass", reliabilityScore: "pass", accessibility: "pass", issueStatus: "Tracked" },
  { domain: "Bulk Import", routes: "/bulk-import", testHealth: "pass", reliabilityScore: "warn", accessibility: "warn", issueStatus: "Tracked" },
  { domain: "Config", routes: "/config", testHealth: "pass", reliabilityScore: "pass", accessibility: "pass", issueStatus: "Tracked" },
  { domain: "Settings", routes: "/setting", testHealth: "pass", reliabilityScore: "pass", accessibility: "pass", issueStatus: "Tracked" },
];

const BADGE: Record<Signal, { label: string; className: string }> = {
  pass: { label: "✅ Pass", className: "bg-green-100 text-green-800" },
  warn: { label: "⚠️ Warn", className: "bg-yellow-100 text-yellow-800" },
  fail: { label: "❌ Fail", className: "bg-red-100 text-red-800" },
  unknown: { label: "— N/A", className: "bg-gray-100 text-gray-500" },
};

function Badge({ signal }: { signal: Signal }) {
  const { label, className } = BADGE[signal];
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export default function Wave5DashboardPage() {
  const [exported, setExported] = useState(false);

  function handleExport() {
    const payload = {
      generatedAt: new Date().toISOString(),
      wave: "Wave 5",
      domains: DOMAINS,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wave5-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  }

  const passing = DOMAINS.filter((d) =>
    [d.testHealth, d.reliabilityScore, d.accessibility].every((s) => s === "pass")
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Wave 5 Closure Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            FE issue and quality signal tracking — {new Date().toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={handleExport}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {exported ? "Exported ✓" : "Export JSON"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Domains", value: DOMAINS.length },
          { label: "All Signals Green", value: passing },
          { label: "Issues Tracked", value: DOMAINS.length },
          { label: "Warnings", value: DOMAINS.filter((d) => [d.testHealth, d.reliabilityScore, d.accessibility].includes("warn")).length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Domain table */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Domain</th>
              <th className="px-4 py-3">Routes</th>
              <th className="px-4 py-3">Test Health</th>
              <th className="px-4 py-3">Reliability</th>
              <th className="px-4 py-3">Accessibility</th>
              <th className="px-4 py-3">Issue Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {DOMAINS.map((row) => (
              <tr key={row.domain} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{row.domain}</td>
                <td className="px-4 py-3 text-slate-500">{row.routes}</td>
                <td className="px-4 py-3"><Badge signal={row.testHealth} /></td>
                <td className="px-4 py-3"><Badge signal={row.reliabilityScore} /></td>
                <td className="px-4 py-3"><Badge signal={row.accessibility} /></td>
                <td className="px-4 py-3 text-slate-600">{row.issueStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
