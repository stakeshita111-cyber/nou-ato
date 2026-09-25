import { describe, it, expect } from "vitest";
import { ApiResponse } from "@/lib/apiResponse";

describe("ApiResponse Helper (RFC 7807 Problem Details)", () => {
  it("generates successful 200 JSON response", async () => {
    const res = ApiResponse.success({ message: "OK", count: 42 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("OK");
    expect(body.count).toBe(42);
  });

  it("generates 400 Bad Request problem details", async () => {
    const res = ApiResponse.badRequest("メッセージが空です", [
      { name: "message", reason: "必須項目です" },
    ]);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.type).toBe("https://httpstatuses.com/400");
    expect(body.title).toBe("Bad Request");
    expect(body.status).toBe(400);
    expect(body.detail).toBe("メッセージが空です");
    expect(body.error).toBe("メッセージが空です"); // 後方互換性
    expect(body.invalidParams).toHaveLength(1);
    expect(body.invalidParams[0].name).toBe("message");
  });

  it("generates 401 Unauthorized problem details", async () => {
    const res = ApiResponse.unauthorized();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.title).toBe("Unauthorized");
    expect(body.status).toBe(401);
  });

  it("generates 403 Forbidden problem details", async () => {
    const res = ApiResponse.forbidden("アクセス権がありません");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.title).toBe("Forbidden");
    expect(body.detail).toBe("アクセス権がありません");
  });

  it("generates 404 Not Found problem details", async () => {
    const res = ApiResponse.notFound("畝が見つかりません");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.title).toBe("Not Found");
    expect(body.detail).toBe("畝が見つかりません");
  });

  it("generates 500 Internal Server Error problem details", async () => {
    const res = ApiResponse.internalError("DB接続エラー");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.title).toBe("Internal Server Error");
    expect(body.detail).toBe("DB接続エラー");
  });
});
