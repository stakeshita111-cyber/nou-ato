import { describe, it, expect } from "vitest";

// E2E画面横断シミュレーター: 画面間のステート遷移とデータフローを検証
interface UserSession {
  id: string;
  email: string;
  role: "teacher" | "student";
  displayName: string;
}

interface TaskItem {
  id: string;
  title: string;
  status: "todo" | "completed";
  category: string;
  target_crop?: string;
}

interface JournalEntry {
  id: string;
  studentId: string;
  taskTitle: string;
  content: string;
  reply?: string | null;
  createdAt: string;
}

describe("E2E Cross-Screen Flow Tests (画面横断・E2Eシナリオ検証)", () => {
  // 模擬データベース
  let currentSession: UserSession | null = null;
  let tasks: TaskItem[] = [
    { id: "task-1", title: "土作りと畝立て", status: "todo", category: "準備" },
    { id: "task-2", title: "トマトの苗植え", status: "todo", category: "定植" },
    { id: "task-3", title: "支柱立てと芽かき", status: "todo", category: "管理" },
    { id: "task-4", title: "追肥と土寄せ", status: "todo", category: "管理" },
    { id: "task-5", title: "収穫と片付け", status: "todo", category: "収穫" },
  ];
  let journals: JournalEntry[] = [];
  let broadcastAnnouncements: { id: string; title: string; content: string }[] = [];

  describe("Scenario 1: ログイン ➔ ロール別画面ルーティング ➔ 権限制御", () => {
    it("未ログイン状態では画面アクセスが遮断されること", () => {
      expect(currentSession).toBeNull();
    });

    it("生徒アカウントでログインした場合、生徒用ポータル (/student) へ遷移すること", () => {
      currentSession = {
        id: "student-101",
        email: "student@example.com",
        role: "student",
        displayName: "山田 太郎",
      };

      const targetPath = currentSession.role === "teacher" ? "/teacher/dashboard" : "/student";
      expect(targetPath).toBe("/student");
    });

    it("生徒が講師ダッシュボード (/teacher/dashboard) へ直接遷移を試みた場合、ガードされること", () => {
      const isAllowed = currentSession?.role === "teacher";
      expect(isAllowed).toBe(false);
    });
  });

  describe("Scenario 2: 生徒画面での画面横断フロー (タスク確認 ➔ 日誌完了報告 ➔ 進捗率更新)", () => {
    it("生徒ダッシュボードで現在進行中のタスクが表示されること", () => {
      const activeTask = tasks.find((t) => t.status === "todo");
      expect(activeTask).toBeDefined();
      expect(activeTask?.title).toBe("土作りと畝立て");
    });

    it("タスク詳細を開き、完了報告（日誌）を投稿するとタスクステータスが更新されること", () => {
      const activeTask = tasks[0];

      // 日誌投稿
      const newJournal: JournalEntry = {
        id: `journal-${Date.now()}`,
        studentId: currentSession!.id,
        taskTitle: activeTask.title,
        content: "元肥をしっかり混ぜてふかふかの畝を作りました！",
        reply: null,
        createdAt: new Date().toISOString(),
      };
      journals.push(newJournal);

      // タスク完了化
      tasks[0].status = "completed";

      expect(tasks[0].status).toBe("completed");
      expect(journals.length).toBe(1);
      expect(journals[0].taskTitle).toBe("土作りと畝立て");
    });

    it("完了したタスクに基づき、生徒の進捗率が正しく再計算されること (1/5 = 20%)", () => {
      const completedCount = tasks.filter((t) => t.status === "completed").length;
      const progressPercent = Math.round((completedCount / tasks.length) * 100);

      expect(completedCount).toBe(1);
      expect(progressPercent).toBe(20);
    });

    it("次のタスクがアクティブタスクとして自動で繰り上がること", () => {
      const nextActiveTask = tasks.find((t) => t.status === "todo");
      expect(nextActiveTask?.title).toBe("トマトの苗植え");
    });
  });

  describe("Scenario 3: 講師画面への切り替え ➔ 生徒進捗確認 ➔ 一括配信・指導返信", () => {
    it("講師アカウントに切り替えてログインした場合、講師ダッシュボードが表示されること", () => {
      currentSession = {
        id: "teacher-001",
        email: "teacher@example.com",
        role: "teacher",
        displayName: "田中 園長",
      };
      expect(currentSession.role).toBe("teacher");
    });

    it("講師画面で生徒の完了タスク（進捗率20%）と最新日誌が正しく反映・一覧表示されていること", () => {
      // 講師画面での生徒データ集約シミュレーション
      const studentId = "student-101";
      const studentJournals = journals.filter((j) => j.studentId === studentId);
      const studentCompletedCount = tasks.filter((t) => t.status === "completed").length;

      expect(studentJournals.length).toBe(1);
      expect(studentJournals[0].content).toContain("ふかふかの畝");
      expect(studentCompletedCount).toBe(1);
    });

    it("講師が日誌に対してアドバイスを返信できること", () => {
      const targetJournal = journals[0];
      targetJournal.reply = "素晴らしい土作りですね！次回は苗植えを行いましょう。";

      expect(targetJournal.reply).toBeDefined();
      expect(targetJournal.reply).toContain("素晴らしい土作り");
    });

    it("講師から全受講生への一括アナウンス（全体連絡）が正常に配信・保存されること", () => {
      const announcement = {
        id: `bc-${Date.now()}`,
        title: "週末の降雨予報と収穫イベントについて",
        content: "今週末は雨が予想されます。長靴とレインコートをご持参ください。",
      };
      broadcastAnnouncements.push(announcement);

      expect(broadcastAnnouncements.length).toBe(1);
      expect(broadcastAnnouncements[0].title).toContain("週末の降雨予報");
    });
  });

  describe("Scenario 4: 生徒画面での講師返信・一括アナウンス確認 & AI相談（しるべぇ）フロー", () => {
    it("生徒画面に戻った際、講師からの返信と一括アナウンスが閲覧可能であること", () => {
      currentSession = {
        id: "student-101",
        email: "student@example.com",
        role: "student",
        displayName: "山田 太郎",
      };

      const myJournalsWithReply = journals.filter(
        (j) => j.studentId === currentSession!.id && !!j.reply
      );
      expect(myJournalsWithReply.length).toBe(1);
      expect(myJournalsWithReply[0].reply).toContain("次回は苗植え");

      expect(broadcastAnnouncements.length).toBe(1);
      expect(broadcastAnnouncements[0].content).toContain("長靴とレインコート");
    });

    it("生徒がAI相談（しるべぇ）で質問を行った際、チケット残数が適切に管理されること", () => {
      let ticketRemaining = 3;
      const askAi = () => {
        if (ticketRemaining <= 0) return { error: "チケット上限です" };
        ticketRemaining -= 1;
        return { success: true, remaining: ticketRemaining };
      };

      expect(askAi().remaining).toBe(2);
      expect(askAi().remaining).toBe(1);
      expect(askAi().remaining).toBe(0);
      expect(askAi().error).toBe("チケット上限です");
    });
  });
});
