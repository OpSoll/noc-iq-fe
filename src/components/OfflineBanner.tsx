"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { useNetworkStatus } from "@/contexts/NetworkStatusContext";
import { Button } from "@/components/ui/button";

export function OfflineBanner() {
  const { isOnline, triggerRetry } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-destructive text-destructive-foreground p-2"
      role="alert"
    >
      <AlertCircle className="h-5 w-5 mr-2" aria-hidden="true" />
      <span className="font-medium">
        Backend unreachable - checking connection...
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={triggerRetry}
        className="ml-4 hover:bg-destructive-foreground/20"
      >
        Retry connection
      </Button>
    </div>
  );
}