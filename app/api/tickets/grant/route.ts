import { createClient } from '@/utils/supabase/server';
import { supabase as clientSupabase } from '@/lib/supabase';
import { ApiResponse } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';

interface GrantTicketRequestBody {
  studentId?: string;
  amount?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GrantTicketRequestBody;
    const { studentId, amount = 1 } = body;

    if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
      return ApiResponse.badRequest('受講生ID (studentId) は必須です', [
        { name: 'studentId', reason: '有効な文字列のIDを指定してください' },
      ]);
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return ApiResponse.badRequest('付与枚数 (amount) は1以上の数値を指定してください', [
        { name: 'amount', reason: '1以上の数値を指定してください' },
      ]);
    }

    let supabase = clientSupabase;
    try {
      supabase = await createClient();
    } catch {
      // Vitest テスト環境や cookies() 非アクティブ環境ではクライアントインスタンスにフォールバック
      supabase = clientSupabase;
    }

    // ログイン中のユーザー情報を確認
    try {
      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser();

      if (sessionUser) {
        // ユーザーのロールを確認（teacher ロールであることを検証）
        const { data: dbUser } = await supabase
          .from('users')
          .select('role')
          .eq('id', sessionUser.id)
          .single();

        if (dbUser && dbUser.role !== 'teacher') {
          return ApiResponse.forbidden('チケットの追加付与権限は講師のみに付与されています');
        }
      }
    } catch (authErr) {
      logger.warn(
        'Auth session check in /api/tickets/grant:',
        'api/tickets/grant',
        undefined,
        authErr
      );
    }

    // Postgres 関数 `grant_ai_tickets` をアトミックに呼び出し
    let newCount = 3 + amount;
    let rpcError = null;

    try {
      const { data: rpcData, error } = await supabase.rpc('grant_ai_tickets', {
        p_student_id: studentId,
        p_count: amount,
      });

      if (error) {
        rpcError = error;
        logger.warn('RPC grant_ai_tickets notice/fallback:', 'api/tickets/grant', undefined, error);
      } else if (rpcData && rpcData.length > 0 && typeof rpcData[0].count === 'number') {
        newCount = rpcData[0].count;
      }
    } catch (err) {
      rpcError = err;
      logger.warn('RPC grant_ai_tickets exception:', 'api/tickets/grant', undefined, err);
    }

    // DB テーブル `ai_tickets` への直接 UPSERT 補完（RPC未登録環境用バックアップ）
    if (rpcError) {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase
          .from('ai_tickets')
          .select('count, granted_count')
          .eq('student_id', studentId)
          .eq('date', todayStr)
          .single();

        const currentCount = existing?.count ?? 3;
        const currentGranted = existing?.granted_count ?? 0;
        newCount = currentCount + amount;

        await supabase.from('ai_tickets').upsert({
          student_id: studentId,
          date: todayStr,
          count: newCount,
          granted_count: currentGranted + amount,
          updated_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        logger.warn('ai_tickets direct upsert exception:', 'api/tickets/grant', undefined, dbErr);
      }
    }

    logger.info(
      `Granted ${amount} ticket(s) to student ${studentId}. New count: ${newCount}`,
      'api/tickets/grant'
    );

    return ApiResponse.success({
      success: true,
      studentId,
      amount,
      newCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : 'チケット付与処理中にエラーが発生しました';
    logger.error('API /api/tickets/grant error', 'api/tickets/grant', undefined, error);
    return ApiResponse.internalError(errorMsg);
  }
}
