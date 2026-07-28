"use client";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
// Closes #342: skeleton loading states for data-bound components
// Closes #341: session timeout warning dialog with auto-logout

function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );
}
export const OutageTableSkeleton = RowsSkeleton;
export const PaymentTableSkeleton = RowsSkeleton;
export const WebhookListSkeleton = RowsSkeleton;
export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
    </div>
  );
}

export function SessionTimeoutDialog({
  expiresInMs,
  warnBeforeMs = 5 * 60_000,
  onExtend,
  onLogout,
}: {
  expiresInMs: number;
  warnBeforeMs?: number;
  onExtend: () => void;
  onLogout: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), Math.max(expiresInMs - warnBeforeMs, 0));
    return () => clearTimeout(timer);
  }, [expiresInMs, warnBeforeMs]);
  if (!visible) return null;
  return (
    <div role="alertdialog" aria-live="assertive" className="fixed bottom-4 right-4 rounded-lg border bg-background p-4 shadow-lg">
      <p className="text-sm">Your session is about to expire.</p>
      <div className="mt-2 flex gap-2">
        <button onClick={onExtend} className="text-sm font-medium">Extend Session</button>
        <button onClick={onLogout} className="text-sm text-muted-foreground">Logout</button>
      </div>
    </div>
  );
}
