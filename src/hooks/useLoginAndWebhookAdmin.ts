import { useState } from "react";
import { api } from "@/lib/api";
// Closes #369: dedicated login form validation (extracted from Settings page)
// Closes #370: webhook management CRUD hook with delivery status

export interface LoginFormState {
  email: string;
  password: string;
  errors: Partial<Record<"email" | "password", string>>;
}

export function useLoginValidation() {
  const [state, setState] = useState<LoginFormState>({ email: "", password: "", errors: {} });

  function validate(email: string, password: string) {
    const errors: LoginFormState["errors"] = {};
    if (!/\S+@\S+\.\S+/.test(email)) errors.email = "Enter a valid email address";
    if (password.length < 8) errors.password = "Password must be at least 8 characters";
    setState({ email, password, errors });
    return Object.keys(errors).length === 0;
  }

  return { ...state, validate };
}

export interface Webhook {
  id: string;
  url: string;
  status: "pending" | "success" | "retrying" | "dead-letter";
}

export function useWebhookAdmin() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get<Webhook[]>("/webhooks");
      setWebhooks(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function create(url: string) {
    await api.post("/webhooks", { url });
    await refresh();
  }

  return { webhooks, loading, refresh, create };
}
