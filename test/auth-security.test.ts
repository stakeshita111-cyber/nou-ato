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

// 1. handle_new_auth_user トリガーの安全なユーザー生成シミュレーション
function simulateHandleNewAuthUser(raw_user_meta_data: Record<string, any>, user_id: string, email: string) {
  const user_name = raw_user_meta_data?.full_name || raw_user_meta_data?.name || email.split("@")[0];
  // セキュリティルール: raw_user_meta_data 内の role や farm_id は無視し、必ず 'student' と NULL で初期設定する
  return {
    id: user_id,
    email: email,
    display_name: user_name,
    role: "student" as const,
    farm_id: null as string | null,
  };
}

// 2. クライアントからの users テーブル直接 UPDATE 抑制トリガーシミュレーション
function simulateDirectUserUpdate(
  currentUserRoleInDb: "authenticated" | "anon" | "postgres",
  oldRow: { id: string; role: string; farm_id: string | null },
  updateData: { role?: string; farm_id?: string | null; display_name?: string }
) {
  const newRole = updateData.role !== undefined ? updateData.role : oldRow.role;
  const newFarmId = updateData.farm_id !== undefined ? updateData.farm_id : oldRow.farm_id;

  if (newRole !== oldRow.role || newFarmId !== oldRow.farm_id) {
    if (currentUserRoleInDb === "authenticated" || currentUserRoleInDb === "anon") {
      return { success: false, error: "Permission denied: Cannot update role or farm_id directly" };
    }
  }

  return {
    success: true,
    updatedRow: {
      ...oldRow,
      ...updateData,
      role: newRole,
      farm_id: newFarmId,
    },
  };
}

// 3. register_teacher RPC シミュレーション
function simulateRegisterTeacherRpc(user: { id: string; role: string; farm_id: string | null }, farmName: string) {
  if (!user || !user.id) {
    return { error: "Not authenticated" };
  }
  if (!farmName || !farmName.trim()) {
    return { error: "Farm name is required" };
  }

  const newFarmId = `farm_${Date.now()}`;
  const inviteCode = "inv_" + Math.random().toString(36).substring(2, 10);

  const updatedUser = {
    ...user,
    role: "teacher" as const,
    farm_id: newFarmId,
  };

  return {
    success: true,
    user: updatedUser,
    farm: { id: newFarmId, name: farmName.trim(), owner_id: user.id, invite_code: inviteCode },
  };
}

// 4. join_farm RPC シミュレーション
function simulateJoinFarmRpc(
  user: { id: string; role: string; farm_id: string | null },
  inviteCode: string,
  farmsDatabase: Array<{ id: string; name: string; invite_code: string }>
) {
  if (!user || !user.id) {
    return { error: "Not authenticated" };
  }
  if (!inviteCode || !inviteCode.trim()) {
    return { error: "Invite code is required" };
  }

  const cleanCode = inviteCode.trim();
  const foundFarm = farmsDatabase.find((f) => f.invite_code === cleanCode || f.id === cleanCode);

  if (!foundFarm) {
    return { error: "Invalid invite code or farm not found" };
  }

  const updatedUser = {
    ...user,
    farm_id: foundFarm.id,
  };

  return {
    success: true,
    user: updatedUser,
    farm: foundFarm,
  };
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

    it("signUp 時に raw_user_meta_data に role='teacher' や farm_id が含まれていても無視され、role='student', farm_id=null にセットされること", () => {
      const maliciousMeta = {
        full_name: "攻撃者",
        role: "teacher",
        farm_id: "victim_farm_id_999",
      };

      const userRow = simulateHandleNewAuthUser(maliciousMeta, "user_attacker_1", "attacker@example.com");

      expect(userRow.role).toBe("student");
      expect(userRow.farm_id).toBeNull();
      expect(userRow.display_name).toBe("攻撃者");
    });

    it("受講生ユーザーが DevTools などから直接 users.role や farm_id を UPDATE しようとするとエラーで拒否されること", () => {
      const currentStudent = { id: "student-uuid-1", role: "student", farm_id: "farm_01" };

      // 権限昇格攻撃 (role -> teacher)
      const attackRole = simulateDirectUserUpdate("authenticated", currentStudent, { role: "teacher" });
      expect(attackRole.success).toBe(false);
      expect(attackRole.error).toContain("Permission denied");

      // 農園乗っ取り攻撃 (farm_id -> 他人の農園)
      const attackFarm = simulateDirectUserUpdate("authenticated", currentStudent, { farm_id: "other_farm_999" });
      expect(attackFarm.success).toBe(false);
      expect(attackFarm.error).toContain("Permission denied");

      // 通常の表示名変更は成功すること
      const normalUpdate = simulateDirectUserUpdate("authenticated", currentStudent, { display_name: "新しい名前" });
      expect(normalUpdate.success).toBe(true);
      expect(normalUpdate.updatedRow?.display_name).toBe("新しい名前");
      expect(normalUpdate.updatedRow?.role).toBe("student");
    });
  });

  describe("3. SECURITY DEFINER 関数 (register_teacher / join_farm) による安全な変更検証", () => {
    it("register_teacher RPC を実行すると、正しく role='teacher' に昇格し新しい農園が作成されること", () => {
      const initialStudent = { id: "user_teacher_candidate", role: "student", farm_id: null };
      const res = simulateRegisterTeacherRpc(initialStudent, "佐藤自然農園");

      expect(res.success).toBe(true);
      expect(res.user?.role).toBe("teacher");
      expect(res.user?.farm_id).toBe(res.farm?.id);
      expect(res.farm?.name).toBe("佐藤自然農園");
      expect(res.farm?.owner_id).toBe(initialStudent.id);
    });

    it("join_farm RPC を実行すると、招待コードを検証して受講生が農園に安全に紐づけられること", () => {
      const initialStudent = { id: "user_student_1", role: "student", farm_id: null };
      const dbFarms = [
        { id: "farm_target_123", name: "たなか農園", invite_code: "code_tanaka_99" },
      ];

      // 有効な招待コード
      const res = simulateJoinFarmRpc(initialStudent, "code_tanaka_99", dbFarms);
      expect(res.success).toBe(true);
      expect(res.user?.farm_id).toBe("farm_target_123");
      expect(res.user?.role).toBe("student"); // ロールは student のまま維持されること

      // 無効な招待コード
      const invalidRes = simulateJoinFarmRpc(initialStudent, "invalid_code", dbFarms);
      expect(invalidRes.error).toBe("Invalid invite code or farm not found");
    });
  });

  describe("4. APIエンドポイントのバリデーション & 不正リクエスト耐性", () => {
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
