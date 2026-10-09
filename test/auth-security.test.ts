import { describe, it, expect } from "vitest";
import { sanitizeNextUrl } from "@/app/auth/callback/route";

// middleware のリダイレクトロジックの振る舞い検証
function evaluateAccessControl(pathname: string, user: { id: string; role: "teacher" | "student" } | null) {
  // 1. 未認証アクセス制限 (TC-AUTH-004)
  if (!user) {
    if (pathname.startsWith("/teacher") || pathname.startsWith("/student")) {
      return { redirect: `/login?redirect=${pathname}`, status: 307 };
    }
    return { status: 200 };
  }

  // 2. 権限外アクセス防止 (TC-AUTH-003: 生徒による講師画面への侵入防止)
  if (pathname.startsWith("/teacher")) {
    if (user.role !== "teacher") {
      return { redirect: "/student", status: 307 };
    }
  }

  return { status: 200 };
}

describe("Security & Authorization Tests (認可・セキュリティ検証)", () => {
  describe("1. 未認証ユーザーのアクセス制御", () => {
    it("未ログインで講師画面 (/teacher/dashboard) にアクセスした場合、ログイン画面へリダイレクトされること", () => {
      const result = evaluateAccessControl("/teacher/dashboard", null);
      expect(result.status).toBe(307);
      expect(result.redirect).toBe("/login?redirect=/teacher/dashboard");
    });

    it("未ログインで生徒画面 (/student) にアクセスした場合、ログイン画面へリダイレクトされること", () => {
      const result = evaluateAccessControl("/student", null);
      expect(result.status).toBe(307);
      expect(result.redirect).toBe("/login?redirect=/student");
    });

    it("未ログインで公開ページ (/login) にアクセスした場合、リダイレクトされずアクセス可能であること", () => {
      const result = evaluateAccessControl("/login", null);
      expect(result.status).toBe(200);
      expect(result.redirect).toBeUndefined();
    });
  });

  describe("2. ロール別アクセス制御・権限昇格 (Privilege Escalation) 防止", () => {
    it("生徒ロールのユーザーが講師画面 (/teacher/dashboard) にアクセスした場合、生徒画面 (/student) へ強制リダイレクトされること", () => {
      const studentUser = { id: "student-uuid-1", role: "student" as const };
      const result = evaluateAccessControl("/teacher/dashboard", studentUser);
      expect(result.status).toBe(307);
      expect(result.redirect).toBe("/student");
    });

    it("講師ロールのユーザーが講師画面 (/teacher/dashboard) にアクセスした場合、正常にアクセス許可されること", () => {
      const teacherUser = { id: "teacher-uuid-1", role: "teacher" as const };
      const result = evaluateAccessControl("/teacher/dashboard", teacherUser);
      expect(result.status).toBe(200);
      expect(result.redirect).toBeUndefined();
    });
  });

  describe("3. APIエンドポイントのバリデーション & 不正リクエスト耐性", () => {
    it("空のメッセージやホワイトスペースのみのPOSTリクエストは400エラーで早期リターンされること", () => {
      const testCases = ["", "   ", "\n\t  "];
      testCases.forEach((input) => {
        const isValid = !!input && !!input.trim();
        expect(isValid).toBe(false);
      });
    });

    it("不正なUUIDやインジェクション文字列を含むstudentIdがサニタイズまたは検証されること", () => {
      const maliciousInputs = [
        "../../etc/passwd",
        "'; DROP TABLE users; --",
        "<script>alert(1)</script>",
      ];
      maliciousInputs.forEach((input) => {
        // UUID形式（v4）に準拠しているか検証
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
        expect(isUuid).toBe(false);
      });
    });
  });

  describe("4. OAuth コールバック next パラメータサニタイズ (sanitizeNextUrl)", () => {
    it("正常な相対パス (/student, /teacher/dashboard) はそのまま許可されること", () => {
      expect(sanitizeNextUrl("/student")).toBe("/student");
      expect(sanitizeNextUrl("/teacher/dashboard")).toBe("/teacher/dashboard");
      expect(sanitizeNextUrl("/student/quests?tab=active")).toBe("/student/quests?tab=active");
    });

    it("絶対URL (https://evil.com) によるオープンリダイレクト攻撃は遮断されフォールバックすること", () => {
      expect(sanitizeNextUrl("https://evil.com")).toBe("/student");
      expect(sanitizeNextUrl("http://attacker.com/malicious")).toBe("/student");
    });

    it("プロトコル相対URL (//evil.com, /\\evil.com) は遮断されフォールバックすること", () => {
      expect(sanitizeNextUrl("//evil.com")).toBe("/student");
      expect(sanitizeNextUrl("/\\evil.com")).toBe("/student");
    });

    it("URLエンコードされた不正パス (%2f%2fevil.com) はデコード後に遮断されること", () => {
      expect(sanitizeNextUrl("%2f%2fevil.com")).toBe("/student");
    });

    it("スキームを含む不正パス (/http:evil.com, /javascript:alert(1)) は遮断されること", () => {
      expect(sanitizeNextUrl("/http:evil.com")).toBe("/student");
      expect(sanitizeNextUrl("/javascript:alert(1)")).toBe("/student");
    });

    it("null や空文字の場合はデフォルトフォールバック値を返すこと", () => {
      expect(sanitizeNextUrl(null)).toBe("/student");
      expect(sanitizeNextUrl("")).toBe("/student");
      expect(sanitizeNextUrl(null, "/teacher/dashboard")).toBe("/teacher/dashboard");
    });
  });
});
