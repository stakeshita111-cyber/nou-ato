import { NextResponse } from "next/server";
import { generateRagAnswer, ChatHistoryItem } from "@/lib/rag/qaKnowledgeRetriever";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      message,
      studentName = "受講生",
      studentId,
      history = [] as ChatHistoryItem[],
      isMemoOnly = false, // 🌟 チケット0枚時のメモ専用モード
      isSpell = false,    // 🌟 秘密のチケット復活呪文
    } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "メッセージが空です" }, { status: 400 });
    }

    const supabase = await createClient();
    
    // ログイン中の認証ユーザー情報があれば優先利用
    let effectiveStudentId = studentId;
    let effectiveStudentName = studentName;

    try {
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      if (sessionUser) {
        if (!effectiveStudentId) effectiveStudentId = sessionUser.id;
        if (!effectiveStudentName || effectiveStudentName === "受講生") {
          effectiveStudentName =
            sessionUser.user_metadata?.full_name ||
            sessionUser.user_metadata?.name ||
            sessionUser.email?.split("@")[0] ||
            "受講生";
        }
      }
    } catch (authErr) {
      console.warn("Auth user resolution in /api/chat/rag:", authErr);
    }

    if (!effectiveStudentId) {
      effectiveStudentId = "acf193c5-f6b4-4514-93a4-958eba0e0c38";
    }

    let reply = "";
    let referencedQa: any[] = [];

    // 🌟 1. 秘密の呪文の場合 🌟
    if (isSpell) {
      reply = `✨【秘密の呪文を確認しました！】🧙‍♂️\n\n本日のAI相談チケットが全回復しました！（残り3回）\nまたいつでも気軽に質問してくださいね🌱`;
    } 
    // 🌟 2. チケット0枚・メモ専用モードの場合 (AIは呼ばずにルールベースで記録) 🌟
    else if (isMemoOnly) {
      reply = `📝【質問メモをお預かりしました】🌱\n\n本日のAI相談チケット（1日3回）を使い切ったため、AIによる即時回答はお休みとなります。\nご相談内容は農園ノートに記録しましたので、次回の来園時に講師より詳しくアドバイスいたしますね！\n\n※チケットは毎晩日本時間0:00に復活します✨`;
    } 
    // 🌟 3. 通常のAIチケット消費モード (Gemini Flash-Lite + 農園ナレッジ) 🌟
    else {
      const ragRes = await generateRagAnswer(
        message.trim(),
        effectiveStudentName,
        history
      );
      reply = ragRes.reply;
      referencedQa = ragRes.referencedQa;
    }

    // 2. Supabase の journals テーブルに対話履歴・質問メモを確実に保存
    try {
      const { error: insertErr } = await supabase.from("journals").insert([
        {
          student_id: effectiveStudentId,
          content: message.trim(),
          // メモ専用の場合は講師の対応待ちとするため、replyをnullにして講師未回答扱いにする（生徒画面には上記案内を即時表示）
          reply: isMemoOnly ? null : reply,
          role: "student",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      if (insertErr) {
        console.error("journals insert error:", insertErr);
      }
    } catch (dbErr) {
      console.warn("journals insert exception:", dbErr);
    }

    return NextResponse.json({
      reply,
      referencedQa,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("API /api/chat/rag error:", error);
    return NextResponse.json(
      { error: error.message || "チャット回答生成中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
