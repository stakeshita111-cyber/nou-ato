import { z } from 'zod';
import {
  searchSimilarKnowledge,
  sanitizePiiText,
  CROPS_LIST,
  STOP_WORDS,
} from '@/lib/rag/qaKnowledgeRetriever';
import { ApiResponse } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import { createClient } from '@/utils/supabase/server';
import { DEFAULT_PRESET_FAQS } from '@/lib/presetFaqs';

const checkKnowledgeRequestBodySchema = z.object({
  question: z.string().optional(),
});

interface KnowledgeMatch {
  id: string;
  question: string;
  answer: string;
  matchedKeywords: string[];
  score: number;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user: sessionUser },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !sessionUser) {
      logger.warn(
        'Unauthorized call to /api/chat/check-knowledge',
        'api/chat/check-knowledge',
        undefined,
        authErr
      );
      return ApiResponse.unauthorized('ナレッジ照会機能の利用にはログインが必要です');
    }

    const rawBody: unknown = await request.json().catch(() => ({}));
    const parseResult = checkKnowledgeRequestBodySchema.safeParse(rawBody);
    const question = parseResult.success ? parseResult.data.question : undefined;
    if (!question || typeof question !== 'string' || !question.trim()) {
      return ApiResponse.success({ matches: [] });
    }

    const qClean = question.trim();

    // 単なる挨拶や報告（「〜した」「〜しました」）で疑問・相談でない場合は一致なし
    const isReportOrGreeting =
      /^(?:こんにちは|おはよう|お疲れ様|ありがとう|.*?(?:収穫した|とれた|採れた|植えた|買った))[！!。\s]*$/i.test(
        qClean
      ) && !/(?:どう|教えて|いい|なぜ|方法|コツ|時期|対策|病気|虫|肥料|水)/.test(qClean);

    if (isReportOrGreeting) {
      return ApiResponse.success({ matches: [] });
    }

    const matches: KnowledgeMatch[] = [];

    // ユーザー質問に含まれる作物を特定
    const queryCrops = CROPS_LIST.filter((crop) => qClean.includes(crop));

    // 1. プリセットFAQとのキーワード一致判定
    for (const faq of DEFAULT_PRESET_FAQS) {
      const keywords = faq.keywords ?? [];
      const hitKeywords = keywords.filter((kw) => qClean.includes(kw));
      if (hitKeywords.length > 0) {
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
    // 🌟 生徒の生相談文には依存せず、回答文(k.answer)および回答内から抽出された相談トピック(k.question)のみから一致キーワードを抽出 🌟
    let dbKnowledge: Awaited<ReturnType<typeof searchSimilarKnowledge>> = [];
    try {
      dbKnowledge = await searchSimilarKnowledge(supabase, qClean);
    } catch (kErr) {
      logger.error(
        'Failed to search DB knowledge in check-knowledge:',
        'api/chat/check-knowledge',
        undefined,
        kErr
      );
      dbKnowledge = [];
    }
    if (dbKnowledge && dbKnowledge.length > 0) {
      for (const k of dbKnowledge) {
        if ((k.similarityScore || 0) >= 4) {
          if (!matches.some((m) => m.question === k.question)) {
            // 一致した具体的キーワードを抽出 (k.question は回答から抽出された相談トピック、k.answer は回答テキスト)
            const topicAndAnswer = k.question + ' ' + k.answer;
            const words = topicAndAnswer.match(/[\u4e00-\u9fa5]{2,}|[\u30a1-\u30f6]{2,}/g) || [];
            const hits = words.filter(
              (w) => qClean.includes(w) && w.length >= 2 && !STOP_WORDS.includes(w)
            );
            const uniqueHits = Array.from(
              new Set([...queryCrops.filter((c) => topicAndAnswer.includes(c)), ...hits])
            );

            // 意味のあるキーワードがヒットしている場合のみ追加
            if (uniqueHits.length > 0) {
              const cleanQ = sanitizePiiText(k.question);
              const cleanA = sanitizePiiText(k.answer);
              matches.push({
                id: `db_${k.id || Math.random().toString(36).slice(2)}`,
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

    return ApiResponse.success({ matches: topMatches });
  } catch (err: unknown) {
    logger.error('check-knowledge processing error', 'api/chat/check-knowledge', undefined, err);
    return ApiResponse.internalError('ナレッジ検索中にエラーが発生しました');
  }
}
