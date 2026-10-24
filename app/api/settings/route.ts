import { z } from 'zod';
import { ApiResponse } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import { createClient } from '@/utils/supabase/server';
import { checkFarmTeacher } from '@/lib/auth/farmMembership';
import { PresetFaqItem } from '@/types/farm';
import { DEFAULT_PRESET_FAQS } from '@/lib/presetFaqs';
import { Database } from '@/types/supabase';

interface ServerSettings {
  showStudentTalkTab: boolean;
  presetFaqs?: PresetFaqItem[];
  [key: string]: unknown;
}

const DEFAULT_SETTINGS: ServerSettings = {
  showStudentTalkTab: true,
  presetFaqs: DEFAULT_PRESET_FAQS,
};

const presetFaqItemSchema = z.object({
  id: z.string().max(100, 'IDは100文字以内で入力してください'),
  chipLabel: z
    .string()
    .min(1, 'ラベルを入力してください')
    .max(50, 'ラベルは50文字以内で入力してください'),
  question: z
    .string()
    .min(1, '質問文を入力してください')
    .max(500, '質問文は500文字以内で入力してください'),
  answer: z
    .string()
    .min(1, '回答文を入力してください')
    .max(2000, '回答文は2000文字以内で入力してください'),
});

const settingsRequestBodySchema = z
  .object({
    showStudentTalkTab: z
      .boolean({
        message: 'showStudentTalkTab は真偽値である必要があります',
      })
      .optional(),
    presetFaqs: z
      .array(presetFaqItemSchema)
      .max(50, 'プリセットFAQは50件以内で設定してください')
      .optional(),
    // 更新する農園。未指定なら講師の users.farm_id (B-4 で画面から表示中の農園を渡す)
    farmId: z.string().uuid('farmId は農園のIDを指定してください').optional(),
  })
  .passthrough();

export async function GET(request?: Request) {
  try {
    logger.info('Fetching global server settings', 'api/settings');

    const url = request ? new URL(request.url) : null;
    const requestedFarmId = url?.searchParams.get('farm_id') || null;

    const supabase = await createClient();
    let targetFarmId: string | null = requestedFarmId;

    // 農園の指定がなければ、ログインユーザーの users.farm_id を使う
    // (指定された農園も含め、取得は RLS により「生徒の自農園 / 講師の所属農園」だけに限られる)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && !targetFarmId) {
        const { data: userData } = await supabase
          .from('users')
          .select('farm_id, role')
          .eq('id', user.id)
          .maybeSingle();

        if (userData?.farm_id) {
          targetFarmId = userData.farm_id;
        }
      }
    } catch (authErr) {
      logger.warn('Auth user lookup in GET /api/settings:', 'api/settings', undefined, authErr);
    }

    let showStudentTalkTab = DEFAULT_SETTINGS.showStudentTalkTab !== false;
    let presetFaqs: PresetFaqItem[] = DEFAULT_PRESET_FAQS;

    if (targetFarmId) {
      const { data: farmData } = await supabase
        .from('farms')
        .select('show_student_talk_tab, preset_faqs')
        .eq('id', targetFarmId)
        .maybeSingle();

      if (
        farmData &&
        farmData.show_student_talk_tab !== null &&
        farmData.show_student_talk_tab !== undefined
      ) {
        showStudentTalkTab = farmData.show_student_talk_tab !== false;
      }
      if (farmData?.preset_faqs) {
        const parsed = z.array(presetFaqItemSchema).safeParse(farmData.preset_faqs);
        if (parsed.success && parsed.data.length > 0) {
          presetFaqs = parsed.data;
        }
      }
    }
    // 農園を特定できない場合は既定値を返す (他農園の設定を代わりに返すことはしない)

    return ApiResponse.success({
      settings: {
        ...DEFAULT_SETTINGS,
        showStudentTalkTab,
        presetFaqs,
      },
      showStudentTalkTab,
      presetFaqs,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '設定の取得に失敗しました';
    logger.error('Failed to fetch settings', 'api/settings', undefined, err);
    return ApiResponse.internalError(errorMsg);
  }
}

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return ApiResponse.badRequest('リクエストボディが不正です');
    }

    const parseResult = settingsRequestBodySchema.safeParse(rawBody);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return ApiResponse.badRequest(issue?.message || 'リクエストボディが不正です');
    }

    const { showStudentTalkTab, presetFaqs, farmId, ...extraSettings } = parseResult.data;

    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return ApiResponse.unauthorized('設定の変更にはログインが必要です');
    }

    // ログイン中ユーザーが teacher ロールであることを検証
    const { data: userData } = await supabase
      .from('users')
      .select('farm_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData || userData.role !== 'teacher') {
      return ApiResponse.forbidden('設定の変更権限は講師のみに付与されています');
    }

    // 更新する農園: 指定があればその農園、なければ講師の users.farm_id
    const targetFarmId = farmId ?? userData.farm_id;
    if (!targetFarmId) {
      return ApiResponse.badRequest('設定を変更する農園を指定してください');
    }

    // 講師としてその農園に所属しているか (farm_members)
    const membership = await checkFarmTeacher(supabase, user.id, targetFarmId);
    if (!membership.ok) {
      logger.error(
        'farm_members lookup failed in /api/settings',
        'api/settings',
        undefined,
        membership.message
      );
      return ApiResponse.internalError('農園の所属確認に失敗しました');
    }
    if (!membership.isTeacher) {
      return ApiResponse.forbidden('所属していない農園の設定は変更できません');
    }

    type FarmUpdate = Database['public']['Tables']['farms']['Update'];
    const updateFields: FarmUpdate = {
      updated_at: new Date().toISOString(),
    };
    if (showStudentTalkTab !== undefined) {
      updateFields.show_student_talk_tab = showStudentTalkTab;
    }
    if (presetFaqs !== undefined) {
      updateFields.preset_faqs = presetFaqs;
    }

    const { error: updateErr } = await supabase
      .from('farms')
      .update(updateFields)
      .eq('id', targetFarmId);
    if (updateErr) {
      logger.error('Failed to update farm settings', 'api/settings', undefined, updateErr);
      return ApiResponse.internalError('設定の保存に失敗しました: ' + updateErr.message);
    }

    const settings: ServerSettings = {
      ...DEFAULT_SETTINGS,
      ...extraSettings,
      showStudentTalkTab: showStudentTalkTab !== undefined ? showStudentTalkTab : true,
      presetFaqs: presetFaqs !== undefined ? presetFaqs : DEFAULT_PRESET_FAQS,
    };

    logger.info('Updated global server settings', 'api/settings', {
      showStudentTalkTab: settings.showStudentTalkTab,
      presetFaqsCount: settings.presetFaqs?.length,
      userId: user.id,
    });

    return ApiResponse.success({
      success: true,
      settings,
      showStudentTalkTab: settings.showStudentTalkTab,
      presetFaqs: settings.presetFaqs,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '設定の更新に失敗しました';
    logger.error('Failed to update settings', 'api/settings', undefined, err);
    return ApiResponse.internalError(errorMsg);
  }
}
