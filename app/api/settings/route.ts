import { ApiResponse } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

interface ServerSettings {
  showStudentTalkTab: boolean;
  [key: string]: unknown;
}

const DEFAULT_SETTINGS: ServerSettings = {
  showStudentTalkTab: true,
};

export async function GET() {
  try {
    logger.info("Fetching global server settings", "api/settings");
    return ApiResponse.success({
      settings: DEFAULT_SETTINGS,
      showStudentTalkTab: DEFAULT_SETTINGS.showStudentTalkTab !== false,
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

    const settings: ServerSettings = {
      ...DEFAULT_SETTINGS,
      ...body,
    };

    const showStudentTalkTab = settings.showStudentTalkTab !== false;

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
