export const HARVEST_REPORT_PREFIX = '【収穫完了報告】';

export interface UnreadJournalSource {
  student_id: string | null;
  reply: string | null;
  is_approved: boolean | null;
  content: string | null;
  bed_id: string | null;
  // journals.bed_id → farm_beds の埋め込み (承認・差し戻し済みかどうかの判定に使う)
  farm_beds: { status: string } | null;
}

/**
 * 収穫完了報告 (submit_bed_completion が作る通知) かどうか。
 * bed_id が無い旧形式・紐付けが外れたもの (swap_farm_plots 後など) は本文の接頭辞で判定する。
 */
export const isHarvestReportJournal = (j: Pick<UnreadJournalSource, 'bed_id' | 'content'>) =>
  j.bed_id !== null || (j.content ?? '').trimStart().startsWith(HARVEST_REPORT_PREFIX);

/**
 * 講師の未読数を生徒ごとに集計する。
 * - 通常の日誌: 未返信かつ未承認なら 1 件
 * - 収穫完了報告: 返信が無く、紐付いた畝がまだ承認待ち (completed_pending) のときだけ数える。
 *   再申請で同じ畝に報告が複数あっても畝ごとに 1 件。承認・差し戻し済みや、畝が分からないものは数えない
 *   (承認しても is_approved は立てないため。docs/BED_HARVEST_RPC_DESIGN.md §6)
 */
export const countUnreadJournalsByStudent = (
  journals: UnreadJournalSource[]
): Record<string, number> => {
  const counts: Record<string, number> = {};
  const countedPendingBeds = new Set<string>();

  for (const j of journals) {
    if (j.reply) continue;
    const sid = j.student_id || 'student_default';

    if (isHarvestReportJournal(j)) {
      if (!j.bed_id || j.farm_beds?.status !== 'completed_pending') continue;
      if (countedPendingBeds.has(j.bed_id)) continue;
      countedPendingBeds.add(j.bed_id);
    } else if (j.is_approved) {
      continue;
    }

    counts[sid] = (counts[sid] || 0) + 1;
  }

  return counts;
};
