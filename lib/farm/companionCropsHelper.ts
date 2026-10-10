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
 * 既存の品種文字列と新しく入力された品種を安全にマージ（混植追加時に既存品種を消さない）
 * 例: ("きゅうり", "ミニトマト") -> "きゅうり、ミニトマト"
 * 例: ("きゅうり、ミニトマト", "きゅうり") -> "きゅうり、ミニトマト" (重複排除)
 * 例: ("", "ミニトマト") -> "ミニトマト"
 */
export function mergeCrops(existingCropName?: string | null, newCropName?: string | null): string {
  const existing = parseCrops(existingCropName);
  const incoming = parseCrops(newCropName);

  if (existing.length === 0 && incoming.length === 0) {
    return newCropName?.trim() || existingCropName?.trim() || '未確定 🌱';
  }
  if (existing.length === 0) {
    return incoming.join('、');
  }
  if (incoming.length === 0) {
    return existing.join('、');
  }

  const merged = Array.from(new Set([...existing, ...incoming]));
  return merged.join('、');
}

/**
 * 畝の登録品種名と、その畝に紐づく過去の記録からすべての品種を漏れなく収集
 * （畝名が過去に上書きされていても、過去ログから自動的に品種を復元・補完できる）
 */
export function getBedAllCrops(
  bedCropName?: string | null,
  records: Array<{ crop_name?: string | null; notes?: string | null }> = []
): string[] {
  const cropSet = new Set<string>();

  // 1. 畝の登録名から品種を分解して追加
  parseCrops(bedCropName).forEach((c) => cropSet.add(c));

  // 2. 各記録の crop_name および notes 内の【品種タグ】から分解して追加
  records.forEach((r) => {
    if (r.crop_name) {
      parseCrops(r.crop_name).forEach((c) => cropSet.add(c));
    }
    if (r.notes) {
      const matches = Array.from(r.notes.matchAll(/【(.*?)】/g));
      matches.forEach((m) => {
        const rawTag = m[1].trim();
        // 括弧付き表記（例: "畝 1 (ミニトマト、きゅうり)"）なら括弧内を取り出す
        const bracketMatch = rawTag.match(/\((.*?)\)/);
        const targetString = bracketMatch ? bracketMatch[1] : rawTag;

        // カンマや読点で各単一品種に分解
        const subCrops = parseCrops(targetString);
        subCrops.forEach((c) => {
          if (
            c &&
            c !== '全体共通' &&
            c !== '未確定 🌱' &&
            c !== '未確定' &&
            c !== '未設定' &&
            c !== '手入れ' &&
            !c.includes('収穫完了') &&
            !c.includes('返信') &&
            !c.startsWith('畝')
          ) {
            cropSet.add(c);
          }
        });
      });
    }
  });

  return Array.from(cropSet);
}

/**
 * 記録が対象の作目に合致しているかを判定（#2: 品種フィルタータブ用）
 * 複数品種が記録されたログ（例: 【ミニトマト、きゅうり】）は各対象品種タブの両方に正しく割り振られる
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

  // 1. notes に【作目タグ】が明記されている場合はそれを最優先判定（タグが存在すればタグで完結判定）
  if (recordNotes) {
    const tagMatch = recordNotes.match(/【(.*?)】/);
    if (tagMatch) {
      const tagContent = tagMatch[1].trim();
      const bracketMatch = tagContent.match(/\((.*?)\)/);
      const targetString = bracketMatch ? bracketMatch[1] : tagContent;
      const cropsInTag = parseCrops(targetString);

      // 管理系タグ（全体共通など）以外の場合はタグで厳密判定
      if (
        targetString !== '全体共通' &&
        !targetString.includes('収穫完了') &&
        !targetString.includes('返信') &&
        !targetString.startsWith('畝')
      ) {
        return cropsInTag.includes(cleanTarget) || targetString.includes(cleanTarget);
      }
    }
  }

  // 2. 作目タグがない場合は recordCropName を判定
  if (recordCropName) {
    const crops = parseCrops(recordCropName);
    if (crops.includes(cleanTarget) || recordCropName.includes(cleanTarget)) {
      return true;
    }
  }

  return false;
}
