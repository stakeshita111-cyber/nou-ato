import { describe, it, expect } from "vitest";
import { formatDate, formatNumber, formatHarvestAmount, formatMoney, formatShirubeSpeech } from "@/lib/utils/formatHelper";

describe("formatHelper", () => {
  it("formats date with slash format", () => {
    const res = formatDate("2026-09-25T10:00:00Z", "slash");
    expect(res).toBe("2026/09/25");
  });

  it("formats date with japanese format including day of week", () => {
    const res = formatDate("2026-09-25T10:00:00+09:00", "japanese");
    expect(res).toContain("9月25日");
  });

  it("handles invalid date gracefully", () => {
    const res = formatDate("invalid-date", "slash");
    expect(res).toBe("invalid-date");
  });

  it("formats numbers as raw, formatted, or with units", () => {
    expect(formatNumber(1500, "raw")).toBe("1500");
    expect(formatNumber(1500, "comma")).toBe("1,500");
    expect(formatNumber(1500, "unit", "g")).toBe("1,500g");
    expect(formatNumber(2000, "unit", "円")).toBe("2,000円");
  });

  it("formats harvest amount correctly", () => {
    expect(formatHarvestAmount("1500g", "unit")).toBe("1,500g");
    expect(formatHarvestAmount("1500g", "comma")).toBe("1,500");
    expect(formatHarvestAmount("1500g", "raw")).toBe("1500");
    expect(formatHarvestAmount(2000, "unit")).toBe("2,000g");
    expect(formatHarvestAmount("1.5kg", "unit")).toBe("1,500g");
  });

  it("formats money correctly", () => {
    expect(formatMoney(10000, "raw")).toBe("¥10000");
    expect(formatMoney(10000, "comma")).toBe("¥10,000");
    expect(formatMoney(10000, "unit")).toBe("¥10,000円");
  });

  it("formats speech text", () => {
    expect(formatShirubeSpeech("こんにちは")).toBe("こんにちは");
  });
});
