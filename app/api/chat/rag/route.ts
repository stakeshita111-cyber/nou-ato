import { NextResponse } from "next/server";
import { generateRagAnswer } from "@/lib/rag/qaKnowledgeRetriever";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, studentName = "受講生", studentId } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "メッセージが空です" }, { status: 400 });
    }

    // 1. Supabase RAG エンジンで回答を生成
    const { reply, referencedQa } = await generateRagAnswer(message.trim(), studentName);

    // 2. Supabase の journals テーブルに会話履歴を確実に保存 (実在カラムのみ)
    const supabase = await createClient();

    try {
      const { error: insertErr } = await supabase.from("journals").insert([
        {
          student_id: studentId || "acf193c5-f6b4-4514-93a4-958eba0e0c38", // 竹下翔様またはログイン生徒
          content: message.trim(),
          reply: reply,
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
