import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { ApiResponse } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';

const grantTicketRequestBodySchema = z.object({
  studentId: z
    .string()
    .min(1, '受講生ID (studentId) は必須です')
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
      message: '有効な文字列のIDを指定してください',
    }),
  amount: z
    .number({ message: '付与枚数 (amount) は1以上の数値を指定してください' })
    .int('付与枚数 (amount) は1以上の数値を指定してください')
    .positive('付与枚数 (amount) は1以上の数値を指定してください')
    .default(1),
});

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return ApiResponse.badRequest('リクエスト内容が正しくありません');
    }

    if (!rawBody.studentId || typeof rawBody.studentId !== 'string' || !rawBody.studentId.trim()) {
      return ApiResponse.badRequest('受講生ID (studentId) は必須です', [
        { name: 'studentId', reason: '有効な文字列のIDを指定してください' },
      ]);
    }

    const parseResult = grantTicketRequestBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return ApiResponse.badRequest(issue?.message || 'リクエスト内容が正しくありません');
    }

    const { studentId, amount } = parseResult.data;

    const supabase = await createClient();

    // 1. 認証チェック（未ログインは 401）
    const {
      data: { user: sessionUser },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !sessionUser) {
      return ApiResponse.unauthorized('チケットの付与にはログインが必要です');
    }

    // 2. 講師権限チェック（農園に所属する teacher でなければ 403）
    const userQuery = supabase.from('users').select('role, farm_id').eq('id', sessionUser.id);
    const userResult =
      typeof userQuery.maybeSingle === 'function'
        ? await userQuery.maybeSingle()
        : await userQuery.single();
    const dbUser = userResult?.data;

    if (!dbUser || dbUser.role !== 'teacher' || !dbUser.farm_id) {
      return ApiResponse.forbidden(
        'チケットの追加付与権限は農園に所属する講師のみに付与されています'
      );
    }

    // 3. 同一農園チェック（他農園の受講生には付与不可）
    const studentQuery = supabase.from('users').select('farm_id, role').eq('id', studentId);
    const studentResult =
      typeof studentQuery.maybeSingle === 'function'
        ? await studentQuery.maybeSingle()
        : await studentQuery.single();
    const targetStudent = studentResult?.data;

    if (!targetStudent) {
      return ApiResponse.notFound('対象の受講生が見つかりません');
    }

    if (targetStudent.farm_id !== dbUser.farm_id) {
      return ApiResponse.forbidden('他農園の受講生にチケットを付与することはできません');
    }

    // 4. Postgres 関数 `grant_ai_tickets` をアトミックに呼び出し
    const { data: rpcData, error: rpcError } = await supabase.rpc('grant_ai_tickets', {
      p_student_id: studentId,
      p_count: amount,
    });

    if (rpcError) {
      logger.error('RPC grant_ai_tickets failure:', 'api/tickets/grant', undefined, rpcError);
      return ApiResponse.internalError('チケット付与処理に失敗しました: ' + rpcError.message);
    }

    let newCount = 3 + amount;
    if (typeof rpcData === 'object' && rpcData !== null) {
      if (
        Array.isArray(rpcData) &&
        rpcData.length > 0 &&
        typeof (rpcData[0] as Record<string, unknown>)?.count === 'number'
      ) {
        newCount = (rpcData[0] as Record<string, unknown>).count as number;
      } else if (typeof (rpcData as Record<string, unknown>).count === 'number') {
        newCount = (rpcData as Record<string, unknown>).count as number;
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
