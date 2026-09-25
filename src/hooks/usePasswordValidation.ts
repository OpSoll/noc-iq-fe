export type PasswordStrengthLevel = 'Weak' | 'Medium' | 'Strong';

export function getPasswordStrength(score: number): PasswordStrengthLevel {
  return score === 5 ? 'Strong' : score >= 3 ? 'Medium' : 'Weak';
}

export function validatePassword(password: string) {
  const validation_result = {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    specialChar: /[\p{P}\p{S}]/u.test(password),
  };
  const password_strength =
    Object.values(validation_result).filter(Boolean).length;
  const strength = getPasswordStrength(password_strength);
  return {
    password_strength,
    validation_result,
    strength,
    isStrong: strength === 'Strong',
  };
}

// Preserve the existing hook API for form consumers.
const usePasswordValidation = validatePassword;
export default usePasswordValidation;
