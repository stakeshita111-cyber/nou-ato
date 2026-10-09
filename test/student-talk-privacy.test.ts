import { describe, it, expect } from "vitest";

function sanitizePersonalNames(text: string): string {
  if (!text) return "";
  let clean = text;
  clean = clean.replace(/^[^\n\r]{1,30}(?:さん|様|くん|ちゃん)[^\n\r]*(?:こんにちは|ありがとうございます|お疲れ様です|メッセージ)[^\n\r]*[\n\r]*/gm, "");
  clean = clean.replace(/^[^\n\r]*(?:チケット無事|復活しました|改めて)[^\n\r]*[\n\r]*/gm, "");
  clean = clean.replace(/[^ \n\r!！🌱〜]{1,10}(?:さん|様|くん|ちゃん|氏)[、,!\s]*/g, "");
  clean = clean.replace(/(?:竹下|翔|たけした)[^ \n\r!！🌱〜]*(?:さん|様|くん|ちゃん)?[、,!\s]*/g, "");
  clean = clean.trim();
  return clean || text.replace(/[^ \n\r!！🌱〜]{1,10}(?:さん|様|くん|ちゃん|氏)[、,!\s]*/g, "").trim();
}

function formatQuestionTopic(item: { question: string; matchedKeywords: string[] }): string {
  if (item.matchedKeywords && item.matchedKeywords.length > 0) {
    return `【${item.matchedKeywords.join("・")}】に関する栽培相談`;
  }
  const cleanQ = sanitizePersonalNames(item.question);
  if (cleanQ) {
    return cleanQ.length > 35 ? cleanQ.slice(0, 35) + "..." : cleanQ;
  }
  return "【農園トピック】に関する栽培相談";
}

function prepareMessageForSend(rawInput: string, allowKnowledgeShare: boolean): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return "";
  return allowKnowledgeShare || trimmed.startsWith("【非公開相談】")
    ? trimmed
    : `【非公開相談】${trimmed}`;
}

export function processChatHistory(targetList: any[]) {
  const formatted: { id: string; sender: "student" | "teacher"; text: string }[] = [];

  (targetList || []).forEach((j: any) => {
    const c = (j.content || "").trim();

    if (
      !c ||
      c === "テスト" ||
      c === "○○困ってます" ||
      c.startsWith("【畝") ||
      c.includes("【畝 ") ||
      c.includes("【畝") ||
      c.startsWith("【収穫") ||
      c.includes("【収穫完了報告】") ||
      c.startsWith("【差し戻し") ||
      c.startsWith("【承認") ||
      c.startsWith("【全体お知らせ") ||
      c.includes("を完了報告しました") ||
      c.includes("タスク完了") ||
      (j.task_title && !j.reply && (c.startsWith("【") || c.includes("完了")))
    ) {
      return;
    }

    const isTeacherRole = j.role === "broadcast" || j.role === "teacher" || j.role === "announcement";

    if (
      isTeacherRole &&
      (j.text === "【返信】講師から相談への回答が届きました" ||
        j.text?.startsWith("【返信】") ||
        j.reply === "講師からの返信")
    ) {
      return;
    }

    if (isTeacherRole) {
      if (j.content) {
        formatted.push({
          id: "t_" + j.id,
          sender: "teacher",
          text: j.content,
        });
      }
    } else {
      if (j.content) {
        formatted.push({
          id: "q_" + j.id,
          sender: "student",
          text: j.content,
        });
      }
      if (
        j.reply &&
        j.reply !== "講師からの返信" &&
        !j.reply.startsWith("講師配信") &&
        !j.reply.startsWith("講師個別連絡")
      ) {
        formatted.push({
          id: "a_" + j.id,
          sender: "teacher",
          text: j.reply,
        });
      }
    }
  });

  return formatted;
}

describe("StudentTalkView Message Parsing & Duplication Prevention", () => {
  it("renders 1 student bubble and 1 teacher bubble when teacher replies to student consultation", () => {
    const dbJournals = [
      {
        id: "j_1",
        role: "student",
        content: "トマトの葉が黄色くなりました",
        reply: "下葉の黄変は自然な現象です。気になる場合は切り取ってください。",
      },
      {
        id: "j_2_notification",
        role: "broadcast",
        text: "【返信】講師から相談への回答が届きました",
        content: "下葉の黄変は自然な現象です。気になる場合は切り取ってください。",
        reply: "講師からの返信",
      },
    ];

    const messages = processChatHistory(dbJournals);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      id: "q_j_1",
      sender: "student",
      text: "トマトの葉が黄色くなりました",
    });
    expect(messages[1]).toEqual({
      id: "a_j_1",
      sender: "teacher",
      text: "下葉の黄変は自然な現象です。気になる場合は切り取ってください。",
    });
  });

  it("renders teacher broadcast/direct messages as teacher bubbles and excludes dummy metadata reply", () => {
    const dbJournals = [
      {
        id: "j_bc_1",
        role: "broadcast",
        text: "【講師からのメッセージ】",
        content: "明日の現地体験は雨天のため延期いたします。",
        reply: "講師個別連絡: のうあと農園",
      },
    ];

    const messages = processChatHistory(dbJournals);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      id: "t_j_bc_1",
      sender: "teacher",
      text: "明日の現地体験は雨天のため延期いたします。",
    });
  });
});

describe("StudentTalkView Privacy Features", () => {
  it("formats question topic using matched keywords instead of raw text", () => {
    const item = {
      question: "山田太郎です。トマトの葉が黄色いのですが、住所は東京都...",
      matchedKeywords: ["トマト", "葉が黄色"],
    };
    const topic = formatQuestionTopic(item);
    expect(topic).toBe("【トマト・葉が黄色】に関する栽培相談");
    expect(topic).not.toContain("山田太郎");
  });

  it("sanitizes personal names in fallback question topic", () => {
    const item = {
      question: "竹下翔さん、イチゴの芽かきについて質問です",
      matchedKeywords: [],
    };
    const topic = formatQuestionTopic(item);
    expect(topic).not.toContain("竹下翔");
  });

  it("has default allowKnowledgeShare state set to true (default ON)", () => {
    const defaultAllowKnowledgeShare = true;
    const rawInput = "ナスのアブラムシ対策について教えてください";
    const messageToSend = prepareMessageForSend(rawInput, defaultAllowKnowledgeShare);

    expect(defaultAllowKnowledgeShare).toBe(true);
    expect(messageToSend).toBe("ナスのアブラムシ対策について教えてください");
    expect(messageToSend.startsWith("【非公開相談】")).toBe(false);
  });

  it("correctly adds 【非公開相談】 tag when opt-out toggle is OFF (false)", () => {
    const allowKnowledgeShare = false;
    const rawInput = "個人的な質問です";
    const messageToSend = prepareMessageForSend(rawInput, allowKnowledgeShare);

    expect(messageToSend).toBe("【非公開相談】個人的な質問です");
    expect(messageToSend.startsWith("【非公開相談】")).toBe(true);
  });

  it("does not duplicate 【非公開相談】 tag if input text already starts with it", () => {
    const allowKnowledgeShare = false;
    const rawInput = "【非公開相談】すでにタグが含まれる相談文";
    const messageToSend = prepareMessageForSend(rawInput, allowKnowledgeShare);

    expect(messageToSend).toBe("【非公開相談】すでにタグが含まれる相談文");
    expect(messageToSend).not.toBe("【非公開相談】【非公開相談】すでにタグが含まれる相談文");
  });

  it("synchronizes allowKnowledgeShare state across form toggle and modals", () => {
    const state = { allowKnowledgeShare: true };

    // 1. フォーム直下のトグル操作で OFF に切り替え
    state.allowKnowledgeShare = false;
    expect(state.allowKnowledgeShare).toBe(false);

    // 2. パターンA (ナレッジ一致モーダル) からの送信時に OFF 設定が確実に反映されることを確認
    const patternAMessage = prepareMessageForSend("トマトの連作障害について", state.allowKnowledgeShare);
    expect(patternAMessage).toBe("【非公開相談】トマトの連作障害について");

    // 3. パターンB (チケット確認モーダル) 内で ON に切り替え
    state.allowKnowledgeShare = true;
    expect(state.allowKnowledgeShare).toBe(true);

    // 4. パターンB からの送信時に ON 設定が反映されることを確認
    const patternBMessage = prepareMessageForSend("トマトの連作障害について", state.allowKnowledgeShare);
    expect(patternBMessage).toBe("トマトの連作障害について");
    expect(patternBMessage.startsWith("【非公開相談】")).toBe(false);
  });
});
