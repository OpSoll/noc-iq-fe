"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveRedirect } from "@/lib/auth/redirectStorage";
import { REDIRECT_KEY } from "@/lib/auth/redirect";
import { LoginForm } from "./LoginForm";

export default function AuthLogicPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const redirect = params.get(REDIRECT_KEY);
    if (redirect) {
      saveRedirect(redirect);
    }
    router.replace("/login");
  }, [params, router]);

  return null;
}
