"use client";

import { useState } from "react";

interface JsonNodeProps {
  value: unknown;
  depth?: number;
}

/** Recursive, collapsible, syntax-highlighted renderer for a JSON value. */
function JsonNode({ value, depth = 0 }: JsonNodeProps) {
  const [collapsed, setCollapsed] = useState(depth > 1);

  if (value === null || value === undefined) {
    return <span className="text-slate-400">null</span>;
  }
  if (typeof value === "string") {
    return <span className="text-emerald-400">&quot;{value}&quot;</span>;
  }
  if (typeof value === "number") {
    return <span className="text-sky-400">{value}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-purple-400">{String(value)}</span>;
  }

  const isArray = Array.isArray(value);
  const entries: Array<[string, unknown]> = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);

  if (entries.length === 0) {
    return <span className="text-slate-400">{isArray ? "[]" : "{}"}</span>;
  }

  return (
    <span>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="mr-1 text-slate-500 hover:text-slate-300"
        aria-label={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? "▶" : "▼"}
      </button>
      {isArray ? "[" : "{"}
      {collapsed ? (
        <span className="text-slate-500"> … {entries.length} items </span>
      ) : (
        <div className="ml-4">
          {entries.map(([key, val], i) => (
            <div key={key}>
              {!isArray && <span className="text-rose-300">&quot;{key}&quot;</span>}
              {!isArray && <span className="text-slate-500">: </span>}
              <JsonNode value={val} depth={depth + 1} />
              {i < entries.length - 1 ? "," : ""}
            </div>
          ))}
        </div>
      )}
      {isArray ? "]" : "}"}
    </span>
  );
}

interface Props {
  title: string;
  payload: unknown;
}

/**
 * Syntax-highlighted, collapsible JSON payload viewer with a copy button —
 * used to render webhook request/response bodies in delivery details.
 */
export function JsonPayloadViewer({ title, payload }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 font-mono text-xs text-slate-100">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-slate-400">{title}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-800"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="overflow-auto whitespace-pre-wrap break-words">
        <JsonNode value={payload} />
      </div>
    </div>
  );
}
