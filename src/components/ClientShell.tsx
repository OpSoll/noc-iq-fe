"use client";

import type { ReactNode } from "react";
import { useConflictDetection } from "@/components/notifications/ConflictNotification";
import { ConflictNotification } from "@/components/notifications/ConflictNotification";
import SessionExpiryModal from "@/components/session/SessionExpiryModal";
import { getPendingMutations, clearAllPendingMutations } from "@/lib/mutationTracker";

export default function ClientShell({ children }: { children: ReactNode }) {
  const { conflict, dismiss, refreshContext } = useConflictDetection();
  const pendingMutations = getPendingMutations().map((m) => ({
    id: m.id,
    description: m.description,
    retry: async () => {
      try {
        const res = await fetch(m.url, {
          method: m.method,
          headers: { "Content-Type": "application/json" },
          body: m.data ? JSON.stringify(m.data) : undefined,
        });
        if (!res.ok) throw new Error(`Retry failed: ${res.status}`);
      } catch (err) {
        throw err;
      }
    },
  }));

  return (
    <>
      {children}
      {conflict && (
        <ConflictNotification
          conflict={conflict}
          onRefreshContext={refreshContext}
          onDismiss={dismiss}
        />
      )}
      <SessionExpiryModal
        isOpen={pendingMutations.length > 0}
        pendingMutations={pendingMutations}
        onReauthenticated={clearAllPendingMutations}
        onDismiss={clearAllPendingMutations}
      />
    </>
  );
}
