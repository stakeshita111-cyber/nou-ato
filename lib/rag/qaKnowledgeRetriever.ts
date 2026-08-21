import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rarwrsrmkubhcndfpokl.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_fxOlNtgJTxAZNzP6QxN-Uw_8SwxpgIe";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface ReferencedQA {
  question: string;
  answer: string;
  similarityScore?: number;
}

/**
 * 過去の生徒質問＆講師回答データから、質問に関連するナレッジを抽出する (重み 1.2 倍適用)
 */
export async function searchSimilarKnowledge(userQuestion: string): Promise<ReferencedQA[]> {
  try {
    // 1. Supabase の journals テーブルから、講師の回答 (reply) が存在する過去データを取得
    const { data: pastJournals, error } = await supabase
      .from("journals")
      .select("content, reply, text")
      .not("reply", "is", null);

    if (error || !pastJournals || pastJournals.length === 0) {
      return [];
    }

    const keywords = userQuestion
      .toLowerCase()
      .replace(/[?？!！、。,\s]+/g, " ")
      .split(" ")
      .filter((k) => k.length >= 2);

    // 2. 関連度スコアリング (DBナレッジ重み 1.2x 適用)
    const DB_KNOWLEDGE_WEIGHT = 1.2;

    const scoredList: { qa: ReferencedQA; score: number }[] = pastJournals
      .map((item) => {
        const text = `${item.content || ""} ${item.text || ""} ${item.reply || ""}`.toLowerCase();
        let matchCount = 0;
        keywords.forEach((k) => {
          if (text.includes(k)) matchCount += 1;
        });

        // 完全一致や部分一致の重み付け
        if (text.includes(userQuestion.toLowerCase())) matchCount += 3;

        // 🌟 DB内ナレッジの重要度に 1.2倍の重みを適用 🌟
        const weightedScore = matchCount * DB_KNOWLEDGE_WEIGHT;

        return {
          qa: {
            question: item.content || item.text || "過去の相談",
            answer: item.reply || "",
            similarityScore: weightedScore,
          },
          score: weightedScore,
        };
      })
      .filter((item) => item.score > 0 && item.qa.answer.trim().length > 0)
      .sort((a, b) => b.score - a.score);

    return scoredList.slice(0, 3).map((s) => s.qa);
  } catch (err) {
    console.error("searchSimilarKnowledge error:", err);
    return [];
  }
}

/**
 * 過去の講師ナレッジ (重み1.2) ＋ 日常会話ハイブリッド RAG 回答生成
 */
export async function generateRagAnswer(
  userQuestion: string,
  studentName: string = "受講生"
): Promise<{ reply: string; referencedQa: ReferencedQA[] }> {
  // 1. 類似ナレッジを検索 (重み1.2適用)
  const referencedQa = await searchSimilarKnowledge(userQuestion);

  // 2. Gemini API Key がある場合は Gemini 1.5 で回答生成
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      const knowledgePrompt = referencedQa.length > 0
        ? `【農園DBナレッジ（重要度重み: 1.2倍・最優先参照）】\n` +
          referencedQa.map((qa, i) => `[事例${i + 1}] 過去の質問:「${qa.question}」➔ 講師の回答:「${qa.answer}」 (関連度スコア: ${qa.similarityScore?.toFixed(1) || 1.2})`).join("\n\n")
        : `【農園DBナレッジ】類似する過去の回答データはありません。一般的な自然栽培の知識と親身な日常会話で対応してください。`;

      const systemPrompt = `
あなたは体験農園「NOU-ATO」の優しく親しみやすい講師アドバイザーAI（しるべえ・講師AI）です。
受講生の「${studentName}」さんからメッセージが届きました。

【対話の基本指針】
1. **普段の気軽な日常会話も大歓迎:**
   - 挨拶（おはよう、こんにちは、お疲れ様など）や雑談（「今日も暑いね」「畑に行くのが楽しみ」など）には、明るく親しみやすいトーン（「〜ですね！」「水分補給しっかりしてくださいね☀️」など）で自然に応答してください。
   - 栽培の専門的な相談でない場合は、無理に専門的な長文にせず、温かい会話のキャッチボールを行ってください。
2. **農園DBナレッジの最優先活用（重み 1.2）:**
   - 野菜の病気、害虫、水やり、追肥、芽かき等の栽培に関する質問や悩みの場合、以下の【農園DBナレッジ】に記載された過去の講師の教えやアドバイス方針を **最優先（重み1.2）** で反映し、矛盾のない的確なアドバイスを行ってください。
3. **トーン＆マナー:**
   - 優しく寄り添う話し方（「〜してみてくださいね🌱」「何かあればいつでも気軽に聞いてくださいね！」）。
   - 読みやすい適度な文章量（150〜350文字程度）。

${knowledgePrompt}

受講生（${studentName}さん）のメッセージ: 「${userQuestion}」
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
          }),
        }
      );

      const resData = await response.json();
      const generatedText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (generatedText) {
        return { reply: generatedText.trim(), referencedQa };
      }
    } catch (apiErr) {
      console.warn("Gemini API call failed, falling back to smart rule-based RAG:", apiErr);
    }
  }

  // 3. フォールバック（Geminiキー未設定時またはエラー時）：
  // A. 栽培ナレッジが見つかった場合
  if (referencedQa.length > 0) {
    const topQa = referencedQa[0];
    const replyText = `${studentName}さん、ご質問ありがとうございます！🌱\n\n過去に講師からは以下のようにアドバイスしています：\n\n「${topQa.answer}」\n\nぜひ試してみてくださいね。他にも気になることがあれば何でも気軽に話しかけてください！🧑‍🌾`;
    return { reply: replyText, referencedQa };
  }

  // B. 日常会話や一般的な挨拶・メッセージの判定
  const q = userQuestion.toLowerCase();
  if (q.includes("おはよう") || q.includes("こんにちは") || q.includes("こんばんは") || q.includes("おつかれ") || q.includes("お疲れ")) {
    return {
      reply: `${studentName}さん、お疲れ様です！🌱\n今日も畑の様子はいかがですか？気になることや質問があれば、いつでも気軽にチャットしてくださいね🧑‍🌾`,
      referencedQa: [],
    };
  }

  if (q.includes("ありがとう") || q.includes("助かり") || q.includes("了解") || q.includes("わかった")) {
    return {
      reply: `どういたしまして！${studentName}さんの野菜が元気に育つよう、いつも応援しています🌱 またいつでも話しかけてくださいね！✨`,
      referencedQa: [],
    };
  }

  // C. 一般的な応答
  const defaultReply = `${studentName}さん、メッセージありがとうございます！🌱\n\n「${userQuestion}」について受け付けました。土の乾き具合や日当たり、葉の様子をよく観察しながら作業を進めてみてくださいね。\n\n次回の講習時に講師にも直接ご相談いただけます！何か変化があればいつでもお気軽に教えてくださいね🧑‍🌾`;
  return { reply: defaultReply, referencedQa: [] };
}
