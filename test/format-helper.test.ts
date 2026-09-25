import { describe, it, expect } from "vitest";
import { formatDate, formatNumber, formatShirubeSpeech } from "@/lib/utils/formatHelper";

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

  it("formats speech text", () => {
    expect(formatShirubeSpeech("こんにちは")).toBe("こんにちは");
  });
});
