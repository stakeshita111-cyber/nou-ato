import { describe, it, expect } from "vitest";
import { GET, POST } from "@/app/api/settings/route";

describe("/api/settings Route Handler", () => {
  it("GET returns default settings with 200 status", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.settings).toEqual({ showStudentTalkTab: true });
    expect(body.showStudentTalkTab).toBe(true);
  });

  it("POST validates body and returns updated settings with 200 status", async () => {
    const request = new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showStudentTalkTab: false, customOption: "test" }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.showStudentTalkTab).toBe(false);
    expect(body.settings).toEqual({
      showStudentTalkTab: false,
      customOption: "test",
    });
  });

  it("POST returns 400 Bad Request when request body is an array or invalid JSON/non-object", async () => {
    const request = new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([1, 2, 3]),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.title).toBe("Bad Request");
    expect(body.detail).toBe("リクエストボディが不正です");
  });
});
