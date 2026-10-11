import { z } from 'zod';
import { ApiResponse } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import { createClient } from '@/utils/supabase/server';
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
  })
  .passthrough();

export async function GET(request?: Request) {
  try {
    logger.info('Fetching global server settings', 'api/settings');

    const url = request ? new URL(request.url) : null;
    const requestedFarmId = url?.searchParams.get('farm_id') || null;

    const supabase = await createClient();
    let targetFarmId: string | null = requestedFarmId;

    // 認証ユーザーから所属農園を特定
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        if (!targetFarmId) {
          const { data: userData } = await supabase
            .from('users')
            .select('farm_id, role')
            .eq('id', user.id)
            .maybeSingle();

          if (userData?.farm_id) {
            targetFarmId = userData.farm_id;
          } else if (userData?.role === 'teacher') {
            const { data: ownedFarm } = await supabase
              .from('farms')
              .select('id')
              .eq('owner_id', user.id)
              .limit(1)
              .maybeSingle();
            if (ownedFarm) {
              targetFarmId = ownedFarm.id;
            }
          }
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
      if (
        farmData?.preset_faqs &&
        Array.isArray(farmData.preset_faqs) &&
        farmData.preset_faqs.length > 0
      ) {
        presetFaqs = farmData.preset_faqs as unknown as PresetFaqItem[];
      }
    } else {
      // フォールバック: DB全体の先頭農園の設定を取得
      const { data: defaultFarm } = await supabase
        .from('farms')
        .select('show_student_talk_tab, preset_faqs')
        .limit(1)
        .maybeSingle();

      if (
        defaultFarm &&
        defaultFarm.show_student_talk_tab !== null &&
        defaultFarm.show_student_talk_tab !== undefined
      ) {
        showStudentTalkTab = defaultFarm.show_student_talk_tab !== false;
      }
      if (
        defaultFarm?.preset_faqs &&
        Array.isArray(defaultFarm.preset_faqs) &&
        defaultFarm.preset_faqs.length > 0
      ) {
        presetFaqs = defaultFarm.preset_faqs as unknown as PresetFaqItem[];
      }
    }

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

    const { showStudentTalkTab, presetFaqs, ...extraSettings } = parseResult.data;

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

    // ログイン中講師が所有/所属する農園を取得・更新
    const { data: ownedFarms } = await supabase
      .from('farms')
      .select('id')
      .or(`owner_id.eq.${user.id}${userData?.farm_id ? `,id.eq.${userData.farm_id}` : ''}`);

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

    let targetFarmId = userData.farm_id;

    if (!targetFarmId) {
      // 農園レコードが未登録の場合は register_teacher RPC 経由で安全に作成
      const { data: regData, error: regErr } = await supabase.rpc('register_teacher', {
        farm_name: 'マイ農園',
      });
      if (regErr) {
        logger.error(
          'register_teacher RPC failed in /api/settings',
          'api/settings',
          undefined,
          regErr
        );
        return ApiResponse.internalError('農園の初期作成に失敗しました: ' + regErr.message);
      }
      const parsedReg = regData as { farm_id?: string } | null;
      targetFarmId = parsedReg?.farm_id || null;
    }

    if (targetFarmId) {
      const { error: updateErr } = await supabase
        .from('farms')
        .update(updateFields)
        .eq('id', targetFarmId);
      if (updateErr) {
        logger.error('Failed to update farm settings', 'api/settings', undefined, updateErr);
        return ApiResponse.internalError('設定の保存に失敗しました: ' + updateErr.message);
      }
    } else if (ownedFarms && ownedFarms.length > 0) {
      const farmIds = ownedFarms.map((f) => f.id);
      const { error: updateErr } = await supabase
        .from('farms')
        .update(updateFields)
        .in('id', farmIds);
      if (updateErr) {
        logger.error('Failed to update farms settings', 'api/settings', undefined, updateErr);
        return ApiResponse.internalError('設定の保存に失敗しました: ' + updateErr.message);
      }
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
