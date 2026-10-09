import { ApiResponse } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { createClient } from "@/utils/supabase/server";

interface ServerSettings {
  showStudentTalkTab: boolean;
  [key: string]: unknown;
}

const DEFAULT_SETTINGS: ServerSettings = {
  showStudentTalkTab: true,
};

export async function GET(request?: Request) {
  try {
    logger.info("Fetching global server settings", "api/settings");

    const url = request ? new URL(request.url) : null;
    const requestedFarmId = url?.searchParams.get("farm_id") || null;

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
            .from("users")
            .select("farm_id, role")
            .eq("id", user.id)
            .maybeSingle();

          if (userData?.farm_id) {
            targetFarmId = userData.farm_id;
          } else if (userData?.role === "teacher") {
            const { data: ownedFarm } = await supabase
              .from("farms")
              .select("id")
              .eq("owner_id", user.id)
              .limit(1)
              .maybeSingle();
            if (ownedFarm) {
              targetFarmId = ownedFarm.id;
            }
          }
        }
      }
    } catch (authErr) {
      logger.warn("Auth user lookup in GET /api/settings:", "api/settings", undefined, authErr);
    }

    let showStudentTalkTab = DEFAULT_SETTINGS.showStudentTalkTab !== false;

    if (targetFarmId) {
      const { data: farmData } = await supabase
        .from("farms")
        .select("show_student_talk_tab")
        .eq("id", targetFarmId)
        .maybeSingle();

      if (farmData && farmData.show_student_talk_tab !== null && farmData.show_student_talk_tab !== undefined) {
        showStudentTalkTab = farmData.show_student_talk_tab !== false;
      }
    } else {
      // フォールバック: DB全体の先頭農園の設定を取得
      const { data: defaultFarm } = await supabase
        .from("farms")
        .select("show_student_talk_tab")
        .limit(1)
        .maybeSingle();

      if (defaultFarm && defaultFarm.show_student_talk_tab !== null && defaultFarm.show_student_talk_tab !== undefined) {
        showStudentTalkTab = defaultFarm.show_student_talk_tab !== false;
      }
    }

    return ApiResponse.success({
      settings: {
        ...DEFAULT_SETTINGS,
        showStudentTalkTab,
      },
      showStudentTalkTab,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "設定の取得に失敗しました";
    logger.error("Failed to fetch settings", "api/settings", undefined, err);
    return ApiResponse.internalError(errorMsg);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ServerSettings>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return ApiResponse.badRequest("リクエストボディが不正です");
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const showStudentTalkTab = body.showStudentTalkTab !== false;

    if (user) {
      // ログイン中講師が所有/所属する農園を取得・更新
      const { data: userData } = await supabase
        .from("users")
        .select("farm_id, role")
        .eq("id", user.id)
        .maybeSingle();

      const { data: ownedFarms } = await supabase
        .from("farms")
        .select("id")
        .or(`owner_id.eq.${user.id}${userData?.farm_id ? `,id.eq.${userData.farm_id}` : ""}`);

      if (ownedFarms && ownedFarms.length > 0) {
        const farmIds = ownedFarms.map((f) => f.id);
        await supabase
          .from("farms")
          .update({
            show_student_talk_tab: showStudentTalkTab,
            updated_at: new Date().toISOString(),
          })
          .in("id", farmIds);
      } else {
        // 農園レコードが未登録の場合は新規作成/upsert
        const newFarmId = userData?.farm_id || crypto.randomUUID();
        await supabase.from("farms").upsert([
          {
            id: newFarmId,
            name: "マイ農園",
            owner_id: user.id,
            show_student_talk_tab: showStudentTalkTab,
            updated_at: new Date().toISOString(),
          },
        ]);
        if (!userData?.farm_id) {
          await supabase.from("users").update({ farm_id: newFarmId }).eq("id", user.id);
        }
      }
    } else {
      // 未ログイン状態でも全体デフォルト設定として1件目の農園があれば更新を試みる
      const { data: firstFarm } = await supabase.from("farms").select("id").limit(1).maybeSingle();
      if (firstFarm) {
        await supabase
          .from("farms")
          .update({
            show_student_talk_tab: showStudentTalkTab,
            updated_at: new Date().toISOString(),
          })
          .eq("id", firstFarm.id);
      }
    }

    const settings: ServerSettings = {
      ...DEFAULT_SETTINGS,
      ...body,
      showStudentTalkTab,
    };

    logger.info("Updated global server settings", "api/settings", {
      showStudentTalkTab,
    });

    return ApiResponse.success({
      success: true,
      settings,
      showStudentTalkTab,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "設定の更新に失敗しました";
    logger.error("Failed to update settings", "api/settings", undefined, err);
    return ApiResponse.internalError(errorMsg);
  }
}
