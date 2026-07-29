"use client";

import { useState, useEffect } from "react";

const usePasswordValidation = (password: string) => {
  const [password_strength, setPasswordStrength] = useState(0);
  const [validation_result, setValidationResult] = useState({
    length: false,
    uppercase: false,
    number: false,
    specialChar: false,
  });

  useEffect(() => {
    const length = password.length >= 8;
    const uppercase = /[A-Z]/.test(password);
    const number = /[0-9]/.test(password);
    const specialChar = /[!@#$%^&*]/.test(password);

    setValidationResult({
      length,
      uppercase,
      number,
      specialChar,
    });

    const strength = [length, uppercase, number, specialChar].filter(
      (v) => v,
    ).length;
    setPasswordStrength(strength);
  }, [password]);

  return { password_strength, validation_result };
};

export default usePasswordValidation;
