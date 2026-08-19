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
 * 過去の生徒質問＆講師回答データから、質問に関連するナレッジを抽出する
 */
export async function searchSimilarKnowledge(userQuestion: string): Promise<ReferencedQA[]> {
  try {
    // 1. Supabase の journals テーブルから、講師の回答 (reply) が存在する過去データを取得
    const { data: pastJournals, error } = await supabase
      .from("journals")
      .select("content, reply, task_title")
      .not("reply", "is", null);

    if (error || !pastJournals || pastJournals.length === 0) {
      return [];
    }

    const keywords = userQuestion
      .toLowerCase()
      .replace(/[?？!！、。,\s]+/g, " ")
      .split(" ")
      .filter((k) => k.length >= 2);

    // 2. 関連度スコアリング (キーワードマッチング + 形態素類似度)
    const scoredList: { qa: ReferencedQA; score: number }[] = pastJournals
      .map((item) => {
        const text = `${item.task_title || ""} ${item.content || ""} ${item.reply || ""}`.toLowerCase();
        let matchCount = 0;
        keywords.forEach((k) => {
          if (text.includes(k)) matchCount += 1;
        });

        // 完全一致や部分一致の重み付け
        if (text.includes(userQuestion.toLowerCase())) matchCount += 3;

        return {
          qa: {
            question: item.content || item.task_title || "過去の相談",
            answer: item.reply || "",
          },
          score: matchCount,
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
 * 過去の講師ナレッジをもとに、生徒へのアドバイスを生成する (RAG)
 */
export async function generateRagAnswer(
  userQuestion: string,
  studentName: string = "受講生"
): Promise<{ reply: string; referencedQa: ReferencedQA[] }> {
  // 1. 類似ナレッジを検索
  const referencedQa = await searchSimilarKnowledge(userQuestion);

  // 2. Gemini API Key がある場合は Gemini 1.5 で回答生成
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      const knowledgePrompt = referencedQa.length > 0
        ? `【参考：過去に講師が生徒に伝えたアドバイス事例】\n` +
          referencedQa.map((qa, i) => `事例${i + 1}:\n質問: ${qa.question}\n講師の回答: ${qa.answer}`).join("\n\n")
        : `【参考ナレッジ】類似する過去の回答事例はまだありません。一般的な自然栽培・有機農業の知見に基づいて回答してください。`;

      const systemPrompt = `
あなたは体験農園「NOU-ATO」の優しい講師アドバイザーAI（しるべえ・講師AI）です。
受講生の「${studentName}」さんから農作業や野菜の栽培に関する相談・質問が届きました。

以下の【参考：過去に講師が生徒に伝えたアドバイス事例】を最優先で踏まえ、
${studentName}さんに寄り添う温かい口調（「〜ですね！」「〜してみてくださいね🌱」など）で、分かりやすく実践的なアドバイスを返信してください。

${knowledgePrompt}

受講生の質問: ${userQuestion}
返信ルール:
1. 簡潔で親しみやすい文章（200〜400文字程度）にしてください。
2. 過去の講師の教えと矛盾しないようにしてください。
3. 最後に「また分からないことがあればいつでも聞いてくださいね！」など温かい一言を添えてください。
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
      console.warn("Gemini API call failed, falling back to rule-based RAG:", apiErr);
    }
  }

  // 3. フォールバック（Geminiキー未設定時またはエラー時）：過去の講師回答を自然に引用した回答生成
  if (referencedQa.length > 0) {
    const topQa = referencedQa[0];
    const replyText = `${studentName}さん、ご質問ありがとうございます！🌱\n\n過去の講習・アドバイスでは、講師から以下のようにアドバイスしています：\n\n「${topQa.answer}」\n\nぜひ試してみてくださいね。他にも気になることがあればいつでも教えてください！🧑‍🌾`;
    return { reply: replyText, referencedQa };
  }

  // 4. ナレッジが見つからない場合の標準応答
  const defaultReply = `${studentName}さん、ご質問ありがとうございます！🌱\n\n「${userQuestion}」について確認しました。土の乾き具合や日当たり、葉の様子をよく観察しながら作業を進めてみてくださいね。\n\n次回の講習時に講師にも直接ご相談いただけます！何か変化があればいつでもお気軽にメッセージしてくださいね🧑‍🌾`;
  return { reply: defaultReply, referencedQa: [] };
}
