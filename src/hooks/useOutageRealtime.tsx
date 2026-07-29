"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Closes #351: real-time outage status updates via Server-Sent Events
// Closes #356: ARIA live region announcements for async state changes

export function useOutageRealtimeStream(streamUrl = "/api/v1/stream/outages") {
  const queryClient = useQueryClient();
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const source = new EventSource(streamUrl, { withCredentials: true });
    sourceRef.current = source;

    source.addEventListener("outage.status_changed", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        id: string;
        status: string;
      };
      queryClient.invalidateQueries({ queryKey: ["outages", payload.id] });
      queryClient.invalidateQueries({ queryKey: ["outages", "list"] });
      announce(`Outage ${payload.id} status changed to ${payload.status}`);
    });

    source.onerror = () => source.close();

    return () => source.close();
  }, [queryClient, streamUrl]);
}

// Minimal aria-live announcer; mount <LiveRegion /> once in the app shell.
let notify: ((msg: string) => void) | null = null;

export function announce(message: string) {
  notify?.(message);
}

export function LiveRegion() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    notify = setMessage;
  }, []);

  return (
    <div aria-live="polite" role="status" className="sr-only">
      {message}
    </div>
  );
}
