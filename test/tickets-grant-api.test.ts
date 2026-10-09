import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/tickets/grant/route";

describe("/api/tickets/grant Route Handler", () => {
  it("POST validates studentId and returns 400 when missing", async () => {
    const request = new Request("http://localhost/api/tickets/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 1 }),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.title).toBe("Bad Request");
    expect(body.detail).toBe("受講生ID (studentId) は必須です");
  });

  it("POST validates amount and returns 400 when invalid", async () => {
    const request = new Request("http://localhost/api/tickets/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: "00000000-0000-0000-0000-000000000001", amount: -1 }),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.title).toBe("Bad Request");
    expect(body.detail).toBe("付与枚数 (amount) は1以上の数値を指定してください");
  });

  it("POST grants ticket successfully with 200 status", async () => {
    const studentId = "00000000-0000-0000-0000-000000000001";
    const request = new Request("http://localhost/api/tickets/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, amount: 1 }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.studentId).toBe(studentId);
    expect(body.amount).toBe(1);
    expect(typeof body.newCount).toBe("number");
  });
});
