export function getWalletErrorMessage(error: unknown): string {
  const e = error as {
    response?: { status?: number };
    message?: string;
  };
  const status = e?.response?.status;

  if (status === 404) return "Wallet not found. Please check your user ID and try again.";
  if (status === 409) return "A wallet already exists for this user.";
  if (status === 422) return "Invalid wallet data. Please check your inputs.";
  if (status === 401 || status === 403) return "You don't have permission to manage wallets.";
  if (status === 0 || !status) return "Network error. Please check your connection and try again.";

  return e?.message || "Wallet operation failed. Please try again.";
}

export function getWalletSuccessMessage(action: string): string {
  const messages: Record<string, string> = {
    create: "Wallet created successfully.",
    link: "Wallet linked successfully.",
    details: "Wallet details loaded.",
    balance: "Wallet balance loaded.",
    signout: "Signed out successfully.",
    "logout-all": "All sessions revoked.",
  };
  return messages[action] ?? "Action completed successfully.";
}

export function getWalletHealthLabel(status: {
  active: boolean;
  funded: boolean;
  trustline_ready: boolean;
  usable: boolean;
}): { label: string; variant: "success" | "warning" | "error" | "info" } {
  if (status.usable) return { label: "Ready", variant: "success" };
  if (!status.active) return { label: "Inactive", variant: "error" };
  if (!status.funded) return { label: "Funding Required", variant: "warning" };
  if (!status.trustline_ready) return { label: "Trustline Missing", variant: "warning" };
  return { label: "Review Required", variant: "info" };
}
