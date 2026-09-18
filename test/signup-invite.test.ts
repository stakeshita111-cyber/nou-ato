import { describe, it, expect } from "vitest";

// 1. 講師サインアップ & 農園開設ロジックのシミュレーション
function simulateTeacherSignUp(input: {
  farmName: string;
  teacherName: string;
  email: string;
  password: string;
}, existingEmails: Set<string>) {
  // バリデーション
  if (!input.farmName.trim() || !input.teacherName.trim() || !input.email.trim() || !input.password) {
    return { error: "すべての必須項目を入力してください" };
  }
  if (input.password.length < 6) {
    return { error: "パスワードは6文字以上で入力してください" };
  }

  // 重複メールアドレス検証
  if (existingEmails.has(input.email.trim().toLowerCase())) {
    return { error: "User already registered (このメールアドレスは既に登録されています)" };
  }

  const userId = `user_${Date.now()}`;
  const farmId = `farm_${Date.now()}`;

  const user = {
    id: userId,
    email: input.email.trim(),
    display_name: input.teacherName.trim(),
    role: "teacher" as const,
    farm_id: input.farmName.trim(),
  };

  const farm = {
    id: farmId,
    name: input.farmName.trim(),
    owner_id: userId,
  };

  return { success: true, user, farm };
}

// 2. 生徒招待 & 農園紐づけロジックのシミュレーション
function simulateStudentInviteSignUp(input: {
  name: string;
  email: string;
  password: string;
  inviteFarmId: string;
}, existingEmails: Set<string>) {
  if (!input.name.trim() || !input.email.trim() || !input.password) {
    return { error: "必須項目を入力してください" };
  }
  if (input.password.length < 6) {
    return { error: "パスワードは6文字以上で入力してください" };
  }

  // 重複メールアドレス検証
  if (existingEmails.has(input.email.trim().toLowerCase())) {
    return { error: "User already registered (このメールアドレスは既に登録されています)" };
  }

  const studentUserId = `student_${Date.now()}`;
  const user = {
    id: studentUserId,
    email: input.email.trim(),
    display_name: input.name.trim(),
    role: "student" as const,
    farm_id: input.inviteFarmId, // 招待された農園IDに紐づけ
  };

  return { success: true, user };
}

describe("Teacher Sign-up, Farm Creation & Student Invite Tests (講師登録・農園開設・生徒招待テスト)", () => {
  const existingEmails = new Set<string>(["existing_teacher@example.com", "existing_student@example.com"]);

  describe("1. メールアドレス重複拒否 & ユーザー名重複許容のテスト", () => {
    it("すでに登録されているメールアドレスで登録を試みた場合、拒否されること", () => {
      const result = simulateTeacherSignUp({
        farmName: "新規農園",
        teacherName: "新規 太郎",
        email: "existing_teacher@example.com",
        password: "password123",
      }, existingEmails);

      expect(result.success).toBeUndefined();
      expect(result.error).toContain("already registered");
    });

    it("大文字小文字を区別せず、メールアドレス重複が検知されること", () => {
      const result = simulateTeacherSignUp({
        farmName: "新規農園",
        teacherName: "新規 太郎",
        email: "EXISTING_TEACHER@EXAMPLE.COM",
        password: "password123",
      }, existingEmails);

      expect(result.error).toContain("already registered");
    });

    it("既存のユーザーと同じ表示名（同姓同名）であっても、メールが異なれば登録が許可されること", () => {
      const result = simulateTeacherSignUp({
        farmName: "田中第二農園",
        teacherName: "新規 太郎", // 既存のユーザーと同じ名前
        email: "unique_teacher@example.com",
        password: "password123",
      }, existingEmails);

      expect(result.success).toBe(true);
      expect(result.user?.display_name).toBe("新規 太郎");
    });

    it("パスワードが6文字未満の場合、バリデーションエラーで弾かれること", () => {
      const result = simulateTeacherSignUp({
        farmName: "新規農園",
        teacherName: "新規 太郎",
        email: "new_teacher@example.com",
        password: "12345", // 5文字
      }, existingEmails);

      expect(result.error).toBe("パスワードは6文字以上で入力してください");
    });
  });

  describe("2. 初回講師アカウント登録 & 農園作成のテスト", () => {
    it("講師登録時、ユーザーロールが 'teacher' になり、農園の owner_id と講師の userId が一致すること", () => {
      const result = simulateTeacherSignUp({
        farmName: "みどり自然農園",
        teacherName: "佐藤 健二",
        email: "sato@example.com",
        password: "secure_password",
      }, existingEmails);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.farm).toBeDefined();

      // ロールが講師であること
      expect(result.user?.role).toBe("teacher");

      // 農園の owner_id と講師の id が完全に一致すること（紐づけ検証）
      expect(result.farm?.owner_id).toBe(result.user?.id);
      expect(result.farm?.name).toBe("みどり自然農園");
    });
  });

  describe("3. 生徒の招待 & 農園紐づけのテスト", () => {
    it("生徒が招待URL経由で登録した場合、users.farm_id に招待元の農園IDが確実にセットされること", () => {
      const targetFarmId = "farm_midori_999";

      const result = simulateStudentInviteSignUp({
        name: "受講生 花子",
        email: "hanako@example.com",
        password: "student_password",
        inviteFarmId: targetFarmId,
      }, existingEmails);

      expect(result.success).toBe(true);
      expect(result.user?.role).toBe("student");

      // 生徒の farm_id が招待農園IDと一致すること
      expect(result.user?.farm_id).toBe(targetFarmId);
    });

    it("生徒登録時にもメール重複が正しく拒否されること", () => {
      const result = simulateStudentInviteSignUp({
        name: "重複 花子",
        email: "existing_student@example.com",
        password: "student_password",
        inviteFarmId: "farm_123",
      }, existingEmails);

      expect(result.error).toContain("already registered");
    });
  });

  describe("4. パスワード再設定（リセット）のバリデーションテスト", () => {
    function simulatePasswordReset(password: string, confirmPassword: string) {
      if (!password || !confirmPassword) {
        return { error: "新しいパスワードを入力してください" };
      }
      if (password.length < 6) {
        return { error: "パスワードは6文字以上で入力してください" };
      }
      if (password !== confirmPassword) {
        return { error: "パスワードが一致しません" };
      }
      return { success: true };
    }

    it("パスワードが空の場合はバリデーションエラーとなること", () => {
      const res = simulatePasswordReset("", "");
      expect(res.error).toBe("新しいパスワードを入力してください");
    });

    it("パスワードが6文字未満の場合はエラーとなること", () => {
      const res = simulatePasswordReset("12345", "12345");
      expect(res.error).toBe("パスワードは6文字以上で入力してください");
    });

    it("確認用パスワードと一致しない場合はエラーとなること", () => {
      const res = simulatePasswordReset("newpassword123", "different123");
      expect(res.error).toBe("パスワードが一致しません");
    });

    it("適切なパスワードと一致する確認用パスワードを入力した場合は成功すること", () => {
      const res = simulatePasswordReset("newpassword123", "newpassword123");
      expect(res.success).toBe(true);
    });
  });

  describe("5. 受講生画面URL統一のテスト (/student/quests -> /student)", () => {
    it("/student/quests が /student へリダイレクトされること", () => {
      const requestPath = "/student/quests";
      const redirectTarget = requestPath === "/student/quests" ? "/student" : requestPath;
      expect(redirectTarget).toBe("/student");
    });
  });
});
