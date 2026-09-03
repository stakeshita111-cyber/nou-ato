import { supabase } from "@/lib/supabase";

export interface ReferencedQA {
  question: string;
  answer: string;
  similarityScore?: number;
}

// 主な作物品種リスト (作物不一致の誤ヒットを防止)
export const CROPS_LIST = [
  "トマト", "ミニトマト", "きゅうり", "キュウリ", "胡瓜",
  "ナス", "なす", "茄子", "ピーマン", "パプリカ",
  "ジャガイモ", "じゃがいも", "馬鈴薯", "サツマイモ", "さつまいも",
  "枝豆", "えだまめ", "エダマメ", "インゲン", "いんげん", "オクラ", "おくら",
  "キャベツ", "レタス", "白菜", "ハクサイ", "ほうれん草", "小松菜",
  "大根", "ダイコン", "人参", "ニンジン", "カブ", "イチゴ", "いちご", "スイカ", "ネギ", "ねぎ"
];

// 一般的すぎてマッチングに使ってはいけない動詞・副詞・助詞
export const STOP_WORDS = [
  "の", "に", "は", "を", "た", "が", "で", "て", "と", "し", "れ", "さ",
  "ある", "いる", "も", "する", "から", "な", "こと", "として", "について",
  "教えて", "ください", "どうすれば", "いいですか", "方法", "どう",
  "たくさん", "いっぱい", "育てる", "育て方", "栽培", "収穫", "収穫した", "採れた", "とれた",
  "コツ", "ポイント", "時期", "タイミング", "おすすめ", "やり方", "仕方", "大きく", "美味しく"
];

/**
 * 過去ナレッジから個人名や呼びかけ（竹下翔さん、〇〇さん等）を完全に自動除去・匿名化
 */
export function sanitizePersonalNames(text: string): string {
  if (!text) return "";
  let clean = text;

  // 1. 文頭の「〇〇さん、こんにちは！😊」等の個人向け挨拶ブロックを除去
  clean = clean.replace(/^[^\n\r]{1,30}さん[、,!\s]*(?:こんにちは|メッセージありがとうございます|おはようございます|お疲れ様です)[^\n\r]*[\n\r]*/gm, "");
  
  // 2. 「チケット無事に復活しましたね✨」などの個人対話文脈行を除去
  clean = clean.replace(/^[^\n\r]*(?:チケット無事|復活しました)[^\n\r]*[\n\r]*/gm, "");

  // 3. 残っている個人名呼びかけ「〇〇さん、」「竹下翔さん」等の除去
  clean = clean.replace(/[^ \n\r!！🌱〜]{1,10}(?:さん|様|くん|ちゃん|氏)[、,!\s]*/g, "");
  clean = clean.replace(/(?:竹下|翔|たけした)[^ \n\r!！🌱〜]*(?:さん|様|くん|ちゃん)?[、,!\s]*/g, "");
  clean = clean.replace(/受講生の?[^ \n\r!！🌱〜]+さん/g, "受講生の方");

  // 4. 文頭の余分な改行の整理
  clean = clean.trim();

  return clean || text.trim();
}

/**
 * ユーザーの質問と過去のナレッジを比較し、関連性の高い順にソートして抽出
 */
export async function searchSimilarKnowledge(
  userQuestion: string
): Promise<ReferencedQA[]> {
  try {
    const { data: dbData, error } = await supabase
      .from("journals")
      .select("id, content, reply, is_approved, student_id")
      .not("reply", "is", null)
      .neq("reply", "");

    if (error || !dbData || dbData.length === 0) {
      return [];
    }

    const pastQa: (ReferencedQA & { id?: string })[] = [];

    // ユーザー質問に含まれる作物を特定
    const queryCrops = CROPS_LIST.filter((crop) => userQuestion.includes(crop));

    // 助詞除去＆重要キーワード抽出 (STOP_WORDSを除外)
    const rawTokens = userQuestion
      .toLowerCase()
      .replace(/[、。！？!?,.\n\r]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 0);

    const questionKeywords: string[] = [];
    rawTokens.forEach((token) => {
      let current = token;
      STOP_WORDS.forEach((sw) => {
        if (current === sw) {
          current = "";
        } else if (current.length > sw.length && (current.endsWith(sw) || current.startsWith(sw))) {
          current = current.replace(new RegExp(`^${sw}|${sw}$`, "g"), "");
        }
      });
      if (current.length >= 2 && !STOP_WORDS.includes(current)) {
        questionKeywords.push(current);
      }
    });

    dbData.forEach((item: any) => {
      if (!item.content || !item.reply) return;

      const itemContent = item.content.toLowerCase();
      const itemReply = item.reply.toLowerCase();
      const fullText = itemContent + " " + itemReply;

      // 🌟【重要】作物の厳格チェック: ユーザーが作物を指定している場合、他作物のノウハウは除外 🌟
      if (queryCrops.length > 0) {
        // このQ&Aに対象作物が含まれているか？
        const containsTargetCrop = queryCrops.some((crop) => fullText.includes(crop.toLowerCase()));
        if (!containsTargetCrop) {
          return; // 対象作物が含まれていなければスキップ（枝豆の質問にピーマンやジャガイモを出さない）
        }
      }

      let score = 0;

      // 1. 重要キーワードの一致
      questionKeywords.forEach((kw) => {
        if (itemContent.includes(kw)) {
          score += kw.length >= 3 ? 6 : 4; // 質問文にキーワードが含まれる場合は高スコア
        } else if (fullText.includes(kw)) {
          score += kw.length >= 3 ? 3 : 1.5;
        }
      });

      // 2. 講師承認済みナレッジ (is_approved = true) の重みづけ 1.2倍
      if (item.is_approved === true) {
        score *= 1.2;
      }

      // スコアが十分に高い（明確な重要語一致がある）ものだけ抽出
      if (score >= 4) {
        pastQa.push({
          id: (item.id || "").toString(),
          question: sanitizePersonalNames(item.content),
          answer: sanitizePersonalNames(item.reply),
          similarityScore: score,
        });
      }
    });

    // 類似スコアが高い順にソートして最大3件抽出
    pastQa.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
    return pastQa.slice(0, 3);
  } catch (e) {
    console.error("searchSimilarKnowledge error:", e);
    return [];
  }
}

/**
 * 過去のQ&Aナレッジをプロンプトに注入し、最適なAI回答を生成 (Gemini Lite最優先・自動カスケード)
 */
export async function getAnswerWithRag(
  userQuestion: string,
  studentName: string = "受講生",
  recentHistoryText: string = ""
): Promise<{ reply: string; referencedQa: ReferencedQA[] }> {
  // 🌟「大量質問テスト」トリガーの即時ルールベース返信 🌟
  if (userQuestion.includes("大量質問テスト")) {
    return {
      reply:
        "【AI相棒（しるべぇ）よりお知らせ】🌱\n\n現在、たくさんの受講生のみなさまからご質問・ご相談をいただいており、本日のAI自動対話枠が上限（混雑状態）に達しております🙇\n\nご入力いただいたメッセージは交換日記として大切にお預かりしておりますので、講師からの直接の回答をお待ちいただくか、お時間を空けて再度お試しくださいね✨\n\n美味しい野菜づくりを応援しています🧑‍🌾",
      referencedQa: [],
    };
  }

  // 1. 類似ナレッジを検索 (重み1.2倍を優先)
  const referencedQa = await searchSimilarKnowledge(userQuestion);

  // 2. Gemini API 呼び出し
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return {
      reply:
        "メッセージを受け付けました！次回来園時に講師より詳しく回答いたしますね🌱",
      referencedQa,
    };
  }

  try {
    const knowledgeSection =
      referencedQa.length > 0
        ? `【農園DBナレッジ（重要度重み: 1.2倍・最優先参照）】\n` +
          referencedQa
            .map(
              (qa, i) =>
                `[事例${i + 1}] 過去の質問:「${qa.question}」➔ 講師の回答:「${qa.answer}」 (関連度スコア: ${
                  qa.similarityScore?.toFixed(1) || 1.2
                })`
            )
            .join("\n\n")
        : `【農園DBナレッジ】該当する過去の指導データはありません。一般的な自然栽培・有機栽培の知見と親身な日常会話で対応してください。`;

    const historySection = recentHistoryText
      ? `【これまでの直近の会話の流れ】\n${recentHistoryText}\n\n`
      : "";

    const systemPrompt = `
あなたは体験農園「NOU-ATO」の優しく親しみやすい講師アドバイザーAI「しるべぇ（講師AI）」です。
体験農園の受講生から相談・メッセージが届きました。

【⚠️ 最重要：プライバシー保護とナレッジ共有の絶対ルール】
回答文の中に、生徒の個人名（「〇〇さん」など）を絶対に含めないでください。
この回答は将来、他の受講生が同じ悩みを抱えた際にも共有ナレッジとして参照されるため、名前を呼ばずに「こんにちは！🌱」「ご質問ありがとうございます！」のように温かく親身なトーンで回答してください。

【対話の基本指針】
1. **普段の気軽な日常会話・挨拶:**
   - 挨拶（おはよう、こんにちは、お疲れ様など）や雑談には、明るく親しみやすいトーンで自然に応答してください。
   - 専門的な相談でない場合は無理に長文にせず、温かい会話のキャッチボールを行ってください。

2. **農園DBナレッジの最優先活用（重み 1.2）:**
   - 野菜の育て方、病気、害虫、水やり、追肥、芽かき等の栽培に関する相談の場合、以下の【農園DBナレッジ】に記載された当農園の講師の教えやアドバイス方針を **最優先（重み1.2）** で反映してください。
   - DBナレッジに記載がある内容は、当農園の実績に基づく確かな知見として「当農園では〜」「以前講師からも〜とお伝えしています」といった形で信頼感を込めて伝えてください。
   - DBナレッジにない部分は、一般的な自然栽培・家庭菜園の安心な知識で補足し、「次回の来園時に講師にも直接ご相談くださいね」と添えてください。

3. **トーン＆マナー:**
   - 優しく寄り添う話し方（「〜してみてくださいね🌱」「何かあればいつでも気軽に聞いてくださいね！」）。
   - 読みやすい適度な文章量（200〜450文字程度、箇条書きや絵文字を適度に活用）。文章は途中で途切れず、最後まで丁寧に完結させてください。

${knowledgeSection}

${historySection}受講生の新しい相談メッセージ: 「${userQuestion}」
`;

    const preferredModel = process.env.GEMINI_MODEL;
    const modelsToTry = [
      preferredModel,
      "gemini-flash-lite-latest",
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash-lite",
      "gemini-flash-latest",
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
    ].filter(Boolean) as string[];

    const uniqueModels = Array.from(new Set(modelsToTry));

    for (const modelName of uniqueModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2500,
              },
            }),
          }
        );

        if (response.ok) {
          const resData = await response.json();
          const parts = resData.candidates?.[0]?.content?.parts || [];
          const generatedText =
            parts
              .filter((p: any) => !p.thought && p.text)
              .map((p: any) => p.text)
              .join("\n")
              .trim() || parts[0]?.text?.trim();

          if (generatedText) {
            return { reply: generatedText, referencedQa };
          }
        }
      } catch (apiErr) {
        console.warn(`Gemini API call to ${modelName} failed:`, apiErr);
      }
    }
  } catch (err) {
    console.warn("Gemini cascade failed, falling back to rate limit message:", err);
  }

  return {
    reply:
      "【AI相棒（しるべぇ）よりお知らせ】🌱\n\n現在、たくさんの受講生のみなさまからご質問・ご相談をいただいており、本日のAI自動対話枠が上限（混雑状態）に達しております🙇\n\nご入力いただいたメッセージは交換日記として大切にお預かりしておりますので、講師からの直接の回答をお待ちいただくか、お時間を空けて再度お試しくださいね✨\n\n美味しい野菜づくりを応援しています🧑‍🌾",
    referencedQa,
  };
}

export interface ChatHistoryItem {
  sender: "student" | "teacher" | "system";
  text: string;
}

export async function generateRagAnswer(
  userQuestion: string,
  studentName: string = "受講生",
  history: ChatHistoryItem[] = []
): Promise<{ reply: string; referencedQa: ReferencedQA[] }> {
  const historyText = history
    .map((h) => `${h.sender === "student" ? "受講生" : "しるべぇ(AI)"}: ${h.text}`)
    .join("\n");
  return getAnswerWithRag(userQuestion, studentName, historyText);
}
