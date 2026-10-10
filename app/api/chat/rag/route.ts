import { z } from 'zod';
import { generateRagAnswer, ChatHistoryItem, ReferencedQA } from '@/lib/rag/qaKnowledgeRetriever';
import { getJstDateString } from '@/lib/ticketManager';
import { createClient } from '@/utils/supabase/server';
import { ApiResponse } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';

const chatRequestBodySchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'メッセージが空です')
    .max(1000, 'メッセージは1000文字以内で入力してください'),
  studentName: z.string().optional(),
  isMemoOnly: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parseResult = chatRequestBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return ApiResponse.badRequest(issue?.message || 'リクエスト内容が正しくありません');
    }

    const { message, studentName = '受講生', isMemoOnly = false } = parseResult.data;

    const supabase = await createClient();

    // 1. 多層防御①: 認証ユーザーチェック (未ログインは 401 即時返却)
    const {
      data: { user: sessionUser },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !sessionUser) {
      logger.warn('Unauthorized call to /api/chat/rag', 'api/chat/rag', undefined, authErr);
      return ApiResponse.unauthorized('AI相談機能の利用にはログインが必要です');
    }

    const studentId = sessionUser.id;
    const effectiveStudentName =
      sessionUser.user_metadata?.full_name ||
      sessionUser.user_metadata?.name ||
      sessionUser.email?.split('@')[0] ||
      studentName;

    const todayJst = getJstDateString();

    // 2. 多層防御②: サーバー側回数制限 (1日3回 + 講師付与チケット分)
    if (!isMemoOnly) {
      // 本日の追加付与チケット数を取得
      let grantedCount = 0;
      try {
        const ticketQuery = supabase
          .from('ai_tickets')
          .select('granted_count')
          .eq('student_id', studentId)
          .eq('date', todayJst);
        const ticketResult =
          typeof ticketQuery?.maybeSingle === 'function'
            ? await ticketQuery.maybeSingle()
            : typeof ticketQuery?.single === 'function'
              ? await ticketQuery.single()
              : null;
        if (ticketResult?.data && typeof ticketResult.data.granted_count === 'number') {
          grantedCount = ticketResult.data.granted_count;
        }
      } catch (e) {
        logger.warn('Failed to query ai_tickets granted_count:', 'api/chat/rag', undefined, e);
      }

      const effectiveLimit = 3 + grantedCount;

      const { data: allowed, error: rpcErr } = await supabase.rpc('check_and_increment_ai_usage', {
        p_user_id: studentId,
        p_date: todayJst,
        p_limit: effectiveLimit,
      });

      if (rpcErr) {
        logger.error(
          'check_and_increment_ai_usage RPC failure in /api/chat/rag:',
          'api/chat/rag',
          undefined,
          rpcErr
        );
        return ApiResponse.serviceUnavailable(
          'サーバーの利用制限チェックに失敗しました。時間をおいて再試行してください'
        );
      }

      if (allowed === false) {
        return ApiResponse.tooManyRequests(
          `本日のAI相談チケット（1日${effectiveLimit}回）上限に達しました`
        );
      }
    }

    // 3. 多層防御③: 会話履歴をブラウザ信頼せず、サーバー側でDB(journals)から最新履歴を取得・構築
    const { data: dbJournals } = await supabase
      .from('journals')
      .select('content, reply, role, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(6);

    const history: ChatHistoryItem[] = [];
    if (dbJournals && dbJournals.length > 0) {
      const reversed = [...dbJournals].reverse();
      for (const j of reversed) {
        if (j.content) {
          history.push({ sender: 'student', text: j.content });
        }
        if (j.reply) {
          history.push({ sender: 'teacher', text: j.reply });
        }
      }
    }

    let reply = '';
    let referencedQa: ReferencedQA[] = [];

    if (isMemoOnly) {
      reply = `📝【質問メモをお預かりしました】🌱\n\n本日のAI相談チケット（1日3回）を使い切ったため、AIによる即時回答はお休みとなります。\nご相談内容は農園ノートに記録しましたので、次回の来園時に講師より詳しくアドバイスいたしますね！\n\n※チケットは毎晩日本時間0:00に復活します✨`;
    } else {
      const ragRes = await generateRagAnswer(message, effectiveStudentName, history);
      reply = ragRes.reply;
      referencedQa = ragRes.referencedQa;
    }

    // 4. Supabase の journals テーブルに対話履歴・質問メモを保存 (is_privateフラグ & is_approved: false)
    const isPrivate = message.startsWith('【非公開相談】');
    try {
      const { error: insertErr } = await supabase.from('journals').insert([
        {
          student_id: studentId,
          content: message,
          reply: isMemoOnly ? null : reply,
          role: 'student',
          is_private: isPrivate,
          is_approved: false, // 承認不可制約により is_private が true の場合は承認不可を保障
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      if (insertErr) {
        logger.error('journals insert error:', 'api/chat/rag', undefined, insertErr);
      }
    } catch (dbErr) {
      logger.warn('journals insert exception:', 'api/chat/rag', undefined, dbErr);
    }

    return ApiResponse.success({
      reply,
      referencedQa,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : 'チャット回答生成中にエラーが発生しました';
    logger.error('API /api/chat/rag error', 'api/chat/rag', undefined, error);
    return ApiResponse.internalError(errorMsg);
  }
}
