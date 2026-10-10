/**
 * コンパニオンプランツ・混植（同じ畝に複数品種を栽培）用ヘルパー関数群
 */

/**
 * 畝の品種文字列から各品種を配列として安全にパース
 * 例: "きゅうり、ミニトマト、中玉トマト" -> ["きゅうり", "ミニトマト", "中玉トマト"]
 * 例: "きゅうり, バジル" -> ["きゅうり", "バジル"]
 */
export function parseCrops(cropName?: string | null): string[] {
  if (
    !cropName ||
    cropName === '未確定 🌱' ||
    cropName === '未確定' ||
    cropName === '未設定' ||
    cropName === '全体共通'
  ) {
    return [];
  }

  return cropName
    .split(/[,、]/)
    .map((c) => c.trim())
    .filter(
      (c) =>
        c.length > 0 && c !== '未確定 🌱' && c !== '未確定' && c !== '未設定' && c !== '全体共通'
    );
}

/**
 * 畝ボタン上の表示用ラベル（#1: 2品種以上なら「きゅうり他2種」形式）
 * 例: "きゅうり、ミニトマト、中玉トマト" -> "きゅうり他2種"
 * 例: "きゅうり" -> "きゅうり"
 * 例: "未確定 🌱" -> "未確定 🌱"
 */
export function formatBedCropLabel(cropName?: string | null): string {
  const crops = parseCrops(cropName);
  if (crops.length === 0) {
    return cropName || '未設定';
  }
  if (crops.length === 1) {
    return crops[0];
  }
  return `${crops[0]}他${crops.length - 1}種`;
}

/**
 * 記録が対象の作目に合致しているかを判定（#2: 品種フィルタータブ用）
 * @param recordCropName 記録に保存されている crop_name
 * @param recordNotes 記録の本文（【きゅうり】タグ等を含む）
 * @param targetCrop 絞り込み対象の品種名、または 'all'（全件）
 */
export function isRecordMatchingCrop(
  recordCropName: string | undefined | null,
  recordNotes: string | undefined | null,
  targetCrop: string
): boolean {
  if (!targetCrop || targetCrop === 'all') return true;

  const cleanTarget = targetCrop.trim();
  if (!cleanTarget) return true;

  // 1. notes に【作目タグ】が明記されている場合はそれを最優先判定
  if (recordNotes) {
    const tagMatch = recordNotes.match(/【(.*?)】/);
    if (tagMatch) {
      const tagContent = tagMatch[1].trim();
      return tagContent === cleanTarget || tagContent.includes(cleanTarget);
    }
  }

  // 2. タグがない場合は recordCropName を判定
  if (recordCropName) {
    const crops = parseCrops(recordCropName);
    if (crops.length === 1 && crops[0] === cleanTarget) {
      return true;
    }
    if (crops.length > 1 && crops.includes(cleanTarget)) {
      return true;
    }
    if (recordCropName === cleanTarget) {
      return true;
    }
  }

  return false;
}
