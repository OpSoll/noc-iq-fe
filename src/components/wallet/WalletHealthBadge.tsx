import { cn } from "@/lib/utils";
import { getWalletHealthLabel } from "@/lib/mutationFeedback";

interface WalletHealthBadgeProps {
  status: {
    active: boolean;
    funded: boolean;
    trustline_ready: boolean;
    usable: boolean;
  } | null;
  className?: string;
}

const variantClasses: Record<string, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-slate-200 bg-slate-50 text-slate-600",
};

export function WalletHealthBadge({ status, className }: WalletHealthBadgeProps) {
  if (!status) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
          "border-slate-200 bg-slate-50 text-slate-400",
          className,
        )}
      >
        Not loaded
      </span>
    );
  }

  const { label, variant } = getWalletHealthLabel(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
    >
      <span
        className={cn(
          "mr-1.5 h-1.5 w-1.5 rounded-full",
          variant === "success" && "bg-emerald-500",
          variant === "warning" && "bg-amber-500",
          variant === "error" && "bg-red-500",
          variant === "info" && "bg-slate-400",
        )}
      />
      {label}
    </span>
  );
}
