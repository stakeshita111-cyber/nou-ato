import { z } from 'zod';
import { generateRagAnswer, ChatHistoryItem, ReferencedQA } from '@/lib/rag/qaKnowledgeRetriever';
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
  isPrivate: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json().catch(() => ({}));
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
    const userMeta = sessionUser.user_metadata;
    const metaFullName = typeof userMeta?.full_name === 'string' ? userMeta.full_name : null;
    const metaName = typeof userMeta?.name === 'string' ? userMeta.name : null;
    const effectiveStudentName =
      metaFullName || metaName || sessionUser.email?.split('@')[0] || studentName;

    // 2. 多層防御②: 2フェーズ台帳によるアトミックな予約 (1日3回 + 講師付与チケット分)
    let reservationId: string | null = null;
    if (!isMemoOnly) {
      const { data: resId, error: rpcErr } = await supabase.rpc('reserve_ai_usage');

      if (rpcErr) {
        logger.error(
          'reserve_ai_usage RPC failure in /api/chat/rag:',
          'api/chat/rag',
          undefined,
          rpcErr
        );
        return ApiResponse.serviceUnavailable(
          'サーバーの利用制限チェックに失敗しました。時間をおいて再試行してください'
        );
      }

      if (!resId) {
        return ApiResponse.tooManyRequests(
          '本日のAI相談チケットの上限に達しました（1日3回＋講師からの追加付与分）'
        );
      }
      reservationId = resId;
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
    let isDegraded = false;

    if (isMemoOnly) {
      reply = `📝【質問メモをお預かりしました】🌱\n\n本日のAI相談チケット（1日3回）を使い切ったため、AIによる即時回答はお休みとなります。\nご相談内容は農園ノートに記録しましたので、次回の来園時に講師より詳しくアドバイスいたしますね！\n\n※チケットは毎晩日本時間0:00に復活します✨`;
    } else {
      try {
        const ragRes = await generateRagAnswer(supabase, message, effectiveStudentName, history);
        reply = ragRes.reply;
        referencedQa = ragRes.referencedQa;
        isDegraded = ragRes.status === 'degraded';
      } catch (genErr) {
        logger.error(
          'generateRagAnswer exception in /api/chat/rag:',
          'api/chat/rag',
          undefined,
          genErr
        );
        reply =
          '【AI相棒（しるべぇ）よりお知らせ】🌱\n\n現在、システムが混雑しております。ご相談内容は質問メモとして保存いたしましたので、講師からの回答をお待ちください。';
        isDegraded = true;
      } finally {
        // AI生成成功時のみチケット確定、失敗・フォールバック時はチケット解放
        if (reservationId) {
          const shouldCommit = !isDegraded;
          await supabase.rpc('finalize_ai_usage', {
            p_id: reservationId,
            p_commit: shouldCommit,
          });
        }
      }
    }

    // 4. Supabase の journals テーブルに対話履歴・質問メモを保存
    //    フォールバック(degraded)時は reply を null (質問メモ) として保存し、ナレッジ汚染を物理防止
    const isPrivate = parseResult.data.isPrivate === true || message.startsWith('【非公開相談】');
    const journalReply = isMemoOnly || isDegraded ? null : reply;
    let saved = true;

    try {
      const { error: insertErr } = await supabase.from('journals').insert([
        {
          student_id: studentId,
          content: message,
          reply: journalReply,
          role: 'student',
          is_private: isPrivate,
          is_approved: false, // 承認不可制約により is_private が true の場合は承認不可を保障
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      if (insertErr) {
        saved = false;
        logger.error('journals insert error:', 'api/chat/rag', undefined, insertErr);
      }
    } catch (dbErr) {
      saved = false;
      logger.warn('journals insert exception:', 'api/chat/rag', undefined, dbErr);
    }

    return ApiResponse.success({
      reply,
      referencedQa,
      saved,
      status: isDegraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : 'チャット回答生成中にエラーが発生しました';
    logger.error('API /api/chat/rag error', 'api/chat/rag', undefined, error);
    return ApiResponse.internalError(errorMsg);
  }
}
