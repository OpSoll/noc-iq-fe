"use client";

import type { ReactNode } from "react";

export type EmptyStateKind = "no-data" | "filtered" | "unavailable" | "error";

interface EmptyStateProps {
  kind: EmptyStateKind;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: ReactNode;
  compact?: boolean;
}

const KIND_CONFIG: Record<
  EmptyStateKind,
  { title: string; description: string; icon: ReactNode }
> = {
  "no-data": {
    title: "No data available",
    description: "There are no records to display for this section yet.",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    ),
  },
  filtered: {
    title: "No matching results",
    description: "Try adjusting your filters or search terms.",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
    ),
  },
  unavailable: {
    title: "Service unavailable",
    description: "This data source is currently unreachable. Please try again later.",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 010 12.728m-2.829-2.829a5 5 0 000-7.07m-4.243 4.243a1 1 0 010-1.414" />
      </svg>
    ),
  },
  error: {
    title: "Something went wrong",
    description: "An unexpected error occurred. Please try again.",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
  },
};

export default function EmptyState({
  kind,
  title,
  description,
  action,
  icon,
  compact = false,
}: EmptyStateProps) {
  const config = KIND_CONFIG[kind];

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className="text-slate-300">{icon ?? config.icon}</div>
        <p className="text-sm font-medium text-slate-500">
          {title ?? config.title}
        </p>
        {description && (
          <p className="text-xs text-slate-400">{description ?? config.description}</p>
        )}
        {action && (
          <button
            onClick={action.onClick}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {action.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-[30vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
          <div className="text-slate-400">{icon ?? config.icon}</div>
        </div>
        <h3 className="text-base font-semibold text-slate-800">
          {title ?? config.title}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {description ?? config.description}
        </p>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
