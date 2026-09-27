import { describe, expect, it } from 'vitest';
import { validatePassword } from './usePasswordValidation';

describe('password validation', () => {
  it.each([
    ['', 0, 'Weak'],
    ['abc', 1, 'Weak'],
    ['Abc1', 3, 'Medium'],
    ['Abcdefghi1!', 4, 'Medium'],
    ['Abcdefghij1!', 5, 'Strong'],
  ])('scores %j', (password, score, strength) => {
    expect(validatePassword(password)).toMatchObject({
      password_strength: score,
      strength,
      isStrong: strength === 'Strong',
    });
  });

  it.each([
    ['Abcdefghi1!', 'length'],
    ['abcdefghij1!', 'uppercase'],
    ['ABCDEFGHIJ1!', 'lowercase'],
    ['Abcdefghijk!', 'number'],
    ['Abcdefghijk1', 'specialChar'],
  ] as const)('rejects a password missing %s (%s)', (password, rule) => {
    const result = validatePassword(password);
    expect(result.validation_result[rule]).toBe(false);
    expect(result.isStrong).toBe(false);
    expect(result.password_strength).toBe(4);
  });

  it('accepts punctuation beyond the old symbol subset, but not whitespace', () => {
    expect(validatePassword('Abcdefghij1_').isStrong).toBe(true);
    expect(validatePassword('Abcdefghij1 ').validation_result.specialChar).toBe(
      false
    );
  });
});
