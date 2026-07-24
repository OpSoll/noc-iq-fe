"use client";

import { Printer } from "lucide-react";

interface PrintButtonProps {
  ariaLabel?: string;
  className?: string;
}

export const PrintButton = ({
  ariaLabel = "Print page",
  className = "",
}: PrintButtonProps) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <button
      onClick={handlePrint}
      aria-label={ariaLabel}
      className={`rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 ${className}`}
      title="Print this page"
    >
      <Printer className="w-4 h-4" />
      Print
    </button>
  );
};

export default PrintButton;