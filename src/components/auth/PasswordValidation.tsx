"use client";

import { CheckCircle, XCircle } from "lucide-react";
import type { validatePassword } from "@/hooks/usePasswordValidation";

type ValidationResult = ReturnType<
  typeof validatePassword
>["validation_result"];
const requirements: { key: keyof ValidationResult; label: string }[] = [
  { key: "length", label: "12+ characters" },
  { key: "uppercase", label: "1 uppercase letter" },
  { key: "lowercase", label: "1 lowercase letter" },
  { key: "number", label: "1 digit" },
  { key: "specialChar", label: "1 special symbol" },
];

export default function PasswordValidation({
  validation_result,
}: {
  validation_result: ValidationResult;
}) {
  return (
    <ul
      aria-label="Password requirements"
      className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm"
    >
      {requirements.map(({ key, label }) => {
        const met = validation_result[key];
        const Icon = met ? CheckCircle : XCircle;
        return (
          <li key={key} className="flex items-center">
            <Icon
              className={`mr-1.5 h-4 w-4 shrink-0 ${met ? "text-green-500" : "text-red-500"}`}
              aria-hidden="true"
            />
            <span>
              <span className="sr-only">{met ? "Met: " : "Not met: "}</span>
              {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
