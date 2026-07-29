"use client";

import { useEffect, useState } from "react";

interface PasswordStrengthProps {
  password_strength: number;
}

const PasswordStrength: React.FC<PasswordStrengthProps> = ({
  password_strength,
}) => {
  const an_arr = Array(4).fill(0);

  return (
    <div className="flex items-center gap-x-2">
      {an_arr.map((_, i) => (
        <div
          key={i}
          className={`h-2 w-full rounded-md ${
            password_strength > i ? "bg-green-500" : "bg-gray-300"
          }`}
        />
      ))}
    </div>
  );
};

export default PasswordStrength;
