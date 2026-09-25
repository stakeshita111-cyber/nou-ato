import { describe, it, expect, vi } from "vitest";
import { logger } from "@/lib/logger";

describe("Logger Utility (Structured JSON & Sanitization)", () => {
  it("formats structured log entry correctly", () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const entry = logger.info("User logged in", "auth", { userId: "u123" });

    expect(entry.level).toBe("info");
    expect(entry.message).toBe("User logged in");
    expect(entry.context).toBe("auth");
    expect(entry.data?.userId).toBe("u123");
    expect(entry.timestamp).toBeDefined();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("masks sensitive keys automatically", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const entry = logger.warn("API request received", "api", {
      apiKey: "secret_12345",
      password: "my-password",
      authorization: "Bearer abcdef",
      safeParam: "hello",
    });

    expect(entry.data?.apiKey).toBe("********");
    expect(entry.data?.password).toBe("********");
    expect(entry.data?.authorization).toBe("********");
    expect(entry.data?.safeParam).toBe("hello");

    consoleSpy.mockRestore();
  });

  it("captures error stack trace on error log", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const testError = new Error("Connection timed out");
    const entry = logger.error("DB error", "database", undefined, testError);

    expect(entry.level).toBe("error");
    expect(entry.error?.name).toBe("Error");
    expect(entry.error?.message).toBe("Connection timed out");
    expect(entry.error?.stack).toBeDefined();

    consoleSpy.mockRestore();
  });
});
