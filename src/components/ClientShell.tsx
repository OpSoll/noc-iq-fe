"use client";

import type { ReactNode } from "react";
import KeyboardShortcuts from "@/components/shortcuts/KeyboardShortcuts";

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <KeyboardShortcuts />
    </>
  );
}
