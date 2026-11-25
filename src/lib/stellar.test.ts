import { describe, expect, it } from "vitest";
import { isValidStellarTxHash, getStellarExpertTxUrl } from "../lib/stellar";

describe("Stellar Validation & Explorer Helpers (#477, #478)", () => {
  const validHashLower = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const validHashUpper = "A1B2C3D4E5F60718293A4B5C6D7E8F90A1B2C3D4E5F60718293A4B5C6D7E8F90";
  const validHashMixed = "A1b2C3d4E5f60718293a4B5c6D7e8F90a1B2c3D4e5F60718293A4b5C6d7E8f90";

  describe("isValidStellarTxHash", () => {
    it("returns true for valid 64-character lowercase hex hash", () => {
      expect(isValidStellarTxHash(validHashLower)).toBe(true);
    });

    it("returns true for valid 64-character uppercase hex hash", () => {
      expect(isValidStellarTxHash(validHashUpper)).toBe(true);
    });

    it("returns true for valid 64-character mixed-case hex hash", () => {
      expect(isValidStellarTxHash(validHashMixed)).toBe(true);
    });

    it("trims surrounding whitespace and returns true", () => {
      expect(isValidStellarTxHash(`  ${validHashLower}  `)).toBe(true);
    });

    it("returns false for hashes shorter than 64 characters", () => {
      expect(isValidStellarTxHash("a1b2c3d4")).toBe(false);
      expect(isValidStellarTxHash(validHashLower.slice(0, 63))).toBe(false);
    });

    it("returns false for hashes longer than 64 characters", () => {
      expect(isValidStellarTxHash(validHashLower + "0")).toBe(false);
    });

    it("returns false for 64 characters containing non-hex characters", () => {
      const invalidChars = "g".repeat(64);
      expect(isValidStellarTxHash(invalidChars)).toBe(false);

      const withSymbol = validHashLower.slice(0, 63) + "z";
      expect(isValidStellarTxHash(withSymbol)).toBe(false);
    });

    it("returns false for empty, null, or undefined values", () => {
      expect(isValidStellarTxHash("")).toBe(false);
      expect(isValidStellarTxHash("   ")).toBe(false);
      expect(isValidStellarTxHash(null)).toBe(false);
      expect(isValidStellarTxHash(undefined)).toBe(false);
    });
  });

  describe("getStellarExpertTxUrl", () => {
    it("returns testnet URL by default", () => {
      const url = getStellarExpertTxUrl(validHashLower);
      expect(url).toBe(`https://stellar.expert/explorer/testnet/tx/${validHashLower}`);
    });

    it("returns testnet URL when explicitly specified", () => {
      const url = getStellarExpertTxUrl(validHashLower, "testnet");
      expect(url).toBe(`https://stellar.expert/explorer/testnet/tx/${validHashLower}`);
    });

    it("returns public/mainnet URL when specified", () => {
      const urlPublic = getStellarExpertTxUrl(validHashLower, "public");
      expect(urlPublic).toBe(`https://stellar.expert/explorer/public/tx/${validHashLower}`);

      const urlMainnet = getStellarExpertTxUrl(validHashLower, "mainnet");
      expect(urlMainnet).toBe(`https://stellar.expert/explorer/public/tx/${validHashLower}`);
    });

    it("trims surrounding whitespace from hash", () => {
      const url = getStellarExpertTxUrl(`  ${validHashLower}  `);
      expect(url).toBe(`https://stellar.expert/explorer/testnet/tx/${validHashLower}`);
    });
  });
});
