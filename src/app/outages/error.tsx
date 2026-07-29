"use client";

import { ErrorState } from "@/components/shared/ErrorState";

export default function Error({
  error,
}: {
  error: Error & { correlationId?: string };
}) {
  return (
    <div className="p-6">
      <ErrorState
        error={{
          message: error?.message || "Unexpected error",
          correlationId: error?.correlationId,
        }}
      />
    </div>
  );
}
