'use client';

import { getPasswordStrength } from '@/hooks/usePasswordValidation';

interface PasswordStrengthProps {
  password_strength: number;
}

export default function PasswordStrength({
  password_strength,
}: PasswordStrengthProps) {
  const strength = getPasswordStrength(password_strength);
  const color = {
    Weak: 'bg-red-500',
    Medium: 'bg-amber-500',
    Strong: 'bg-green-500',
  }[strength];
  return (
    <div className="space-y-1">
      <p>Password strength: {strength}</p>
      <div
        role="progressbar"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={password_strength}
        aria-valuetext={strength}
        className="h-2 overflow-hidden rounded-md bg-gray-300"
      >
        <div
          className={`h-full ${color}`}
          style={{ width: `${password_strength * 20}%` }}
        />
      </div>
    </div>
  );
}
