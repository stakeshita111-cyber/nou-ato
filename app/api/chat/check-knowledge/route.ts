import { NextResponse } from "next/server";
import {
  searchSimilarKnowledge,
  sanitizePersonalNames,
  CROPS_LIST,
  STOP_WORDS,
} from "@/lib/rag/qaKnowledgeRetriever";

// プリセットFAQデータ (明確な事象キーワードでのみヒット)
const PRESET_FAQS = [
  {
    id: "faq_fertilizer",
    question: "追肥のタイミングやおすすめのやり方を教えてください",
    answer: "【農園アドバイス：追肥の基本】🌱\n\n植え付けから2〜3週間後、または一番果（最初の実）がついた頃が1回目の追肥タイミングです！\n株元から少し離れた場所に肥料を一握り施し、土と軽く混ぜてあげてくださいね。有機ぼかし肥や油かすを使うと根を傷めず元気に育ちます✨",
    keywords: ["追肥", "肥料", "ぼかし肥", "油かす", "元肥", "施肥"],
  },
  {
    id: "faq_yellow_leaf",
    question: "葉っぱが黄色くなってきました。どうすればいいですか？",
    answer: "【農園アドバイス：葉の黄変について】🍅\n\n・一番下の古い葉が黄色い場合：自然な老化ですので、風通しを良くするため根本からハサミで切り取って大丈夫です。\n・株全体や上部が黄色い場合：水切れ、または肥料切れ（チッソ不足）の可能性があります。土の乾き具合を確認し、必要に応じて追肥を行ってみてくださいね！",
    keywords: ["黄色", "葉が黄色", "黄変", "下葉が黄色"],
  },
  {
    id: "faq_pest",
    question: "害虫（ハダニやアブラムシ）を見つけました。無農薬での対策は？",
    answer: "【農園アドバイス：安心な害虫対策】🐛\n\n・アブラムシ・ハダニ：葉の裏に勢いよく水をかける「葉水」がとても効果的です。水で薄めたお酢や牛乳スプレーも窒息効果があります。\n・アオムシ等：見つけたら割り箸などで優しく捕殺するのが確実です。早めの発見が大切ですので、葉の裏をこまめに観察してくださいね！",
    keywords: ["害虫", "ハダニ", "アブラムシ", "アオムシ", "虫退治", "無農薬", "駆除", "葉水"],
  },
  {
    id: "faq_watering",
    question: "夏の水やりのタイミングや頻度を教えてください",
    answer: "【農園アドバイス：水やりのコツ】💧\n\n基本は「朝の涼しい時間帯（早朝〜8時頃）」にたっぷりとあげるのがベストです！\n日中の暑い時間に水をあげるとお湯のようになって根を傷める原因になります。土の表面が乾いて白っぽくなったら、株元にしっかりあげてくださいね🌱",
    keywords: ["水やり", "水遣り", "水やり頻度", "水やりの時間", "乾燥気味", "散水"],
  },
];

export async function POST(request: Request) {
  try {
    const { question } = await request.json();
    if (!question || !question.trim()) {
      return NextResponse.json({ matches: [] });
    }

    const qClean = question.trim();

    // 単なる挨拶や報告（「〜した」「〜しました」）で疑問・相談でない場合は一致なし
    const isReportOrGreeting = /^(?:こんにちは|おはよう|お疲れ様|ありがとう|.*?(?:収穫した|とれた|採れた|植えた|買った))[！!。\s]*$/i.test(qClean) &&
      !/(?:どう|教えて|いい|なぜ|方法|コツ|時期|対策|病気|虫|肥料|水)/.test(qClean);

    if (isReportOrGreeting) {
      return NextResponse.json({ matches: [] });
    }

    const matches: Array<{
      id: string;
      question: string;
      answer: string;
      matchedKeywords: string[];
      score: number;
    }> = [];

    // ユーザー質問に含まれる作物を特定
    const queryCrops = CROPS_LIST.filter((crop) => qClean.includes(crop));

    // 1. プリセットFAQとのキーワード一致判定
    for (const faq of PRESET_FAQS) {
      const hitKeywords = faq.keywords.filter((kw) => qClean.includes(kw));
      if (hitKeywords.length > 0) {
        // もしユーザーが特定作物を指定している場合、一般的なFAQはスコア調整
        matches.push({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          matchedKeywords: hitKeywords,
          score: hitKeywords.length * 10,
        });
      }
    }

    // 2. Supabase DB (journals承認済みナレッジ) の厳格検索
    const dbKnowledge = await searchSimilarKnowledge(qClean);
    if (dbKnowledge && dbKnowledge.length > 0) {
      for (const k of dbKnowledge) {
        if ((k.similarityScore || 0) >= 4) {
          if (!matches.some((m) => m.question === k.question)) {
            // 一致した具体的キーワードを抽出 (STOP_WORDSは除外)
            const words = (k.question + " " + k.answer).match(/[\u4e00-\u9fa5]{2,}|[\u30a1-\u30f6]{2,}/g) || [];
            const hits = words.filter(
              (w) => qClean.includes(w) && w.length >= 2 && !STOP_WORDS.includes(w)
            );
            const uniqueHits = Array.from(new Set([...queryCrops.filter(c => (k.question + k.answer).includes(c)), ...hits]));

            // 意味のあるキーワードがヒットしている場合のみ追加
            if (uniqueHits.length > 0) {
              const cleanQ = sanitizePersonalNames(k.question);
              const cleanA = sanitizePersonalNames(k.answer);
              matches.push({
                id: "db_" + ((k as any).id || Math.random().toString(36).slice(2)),
                question: cleanQ,
                answer: cleanA,
                matchedKeywords: uniqueHits,
                score: (k.similarityScore || 0) * 1.5,
              });
            }
          }
        }
      }
    }

    // スコア順にソートして最大3件返却
    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, 3);

    return NextResponse.json({ matches: topMatches });
  } catch (err: any) {
    console.error("check-knowledge error:", err);
    return NextResponse.json({ matches: [] });
  }
}
