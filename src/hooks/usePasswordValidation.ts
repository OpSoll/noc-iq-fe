"use client";



const usePasswordValidation = (password: string) => {
  const length = password.length >= 8;
  const uppercase = /[A-Z]/.test(password);
  const number = /[0-9]/.test(password);
  const specialChar = /[!@#$%^&*]/.test(password);

  const validation_result = {
    length,
    uppercase,
    number,
    specialChar,
  };

  const password_strength = [length, uppercase, number, specialChar].filter(
    Boolean,
  ).length;

  return { password_strength, validation_result };
};

export default usePasswordValidation;
