"use client";

import { useCallback, useState } from "react";
import { Copy, Check } from "lucide-react";
import { explorerLink } from "@/lib/explorer";
import { useToast } from "@/components/ui/toast";

interface WalletAddressProps {
  address: string | null | undefined;
  showExplorerLink?: boolean;
  className?: string;
}

export function WalletAddress({
  address,
  showExplorerLink = true,
  className = "",
}: WalletAddressProps) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleCopy = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast("Wallet address copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = address;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      toast("Wallet address copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    }
  }, [address, toast]);

  if (!address) {
    return (
      <span className={`text-slate-400 ${className}`}>
        No address available
      </span>
    );
  }

  const link = showExplorerLink ? explorerLink("account", address) : null;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate font-mono text-sm text-blue-600 hover:underline"
          title={address}
        >
          {address}
        </a>
      ) : (
        <span
          className="truncate font-mono text-sm text-slate-900"
          title={address}
        >
          {address}
        </span>
      )}
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        title={copied ? "Copied!" : "Copy address"}
        aria-label={copied ? "Address copied" : "Copy address to clipboard"}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </span>
  );
}