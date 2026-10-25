import { describe, expect, it } from 'vitest';
import {
  countUnreadJournalsByStudent,
  isHarvestReportJournal,
  type UnreadJournalSource,
} from '@/lib/utils/journalUnread';

const STUDENT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STUDENT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const HARVEST_TEXT =
  '【収穫完了報告】区画 A1 / 畝 1 (ミニトマト) の収穫が完了しました！\n収穫量: 3kg\n振り返り: よく育った';

const journal = (overrides: Partial<UnreadJournalSource>): UnreadJournalSource => ({
  student_id: STUDENT_A,
  reply: null,
  is_approved: false,
  content: '今日は水やりをしました',
  bed_id: null,
  farm_beds: null,
  ...overrides,
});

const harvest = (overrides: Partial<UnreadJournalSource>): UnreadJournalSource =>
  journal({ content: HARVEST_TEXT, bed_id: 'bed-1', ...overrides });

describe('isHarvestReportJournal', () => {
  it('bed_id がある日誌は収穫完了報告として扱う', () => {
    expect(isHarvestReportJournal({ bed_id: 'bed-1', content: '本文' })).toBe(true);
  });

  it('bed_id が無くても本文が【収穫完了報告】で始まれば収穫完了報告として扱う', () => {
    expect(isHarvestReportJournal({ bed_id: null, content: `  ${HARVEST_TEXT}` })).toBe(true);
  });

  it('通常の日誌は収穫完了報告ではない (本文の途中に語があっても)', () => {
    expect(isHarvestReportJournal({ bed_id: null, content: '収穫完了報告を書きました' })).toBe(
      false
    );
    expect(isHarvestReportJournal({ bed_id: null, content: null })).toBe(false);
  });
});

describe('countUnreadJournalsByStudent', () => {
  it('通常の日誌：未返信かつ未承認だけを数える (従来どおり)', () => {
    const counts = countUnreadJournalsByStudent([
      journal({}),
      journal({ reply: '見ました' }),
      journal({ is_approved: true }),
      journal({ student_id: STUDENT_B }),
    ]);
    expect(counts).toEqual({ [STUDENT_A]: 1, [STUDENT_B]: 1 });
  });

  it('承認待ちの畝の収穫完了報告は 1 件として数える', () => {
    const counts = countUnreadJournalsByStudent([
      harvest({ farm_beds: { status: 'completed_pending' } }),
    ]);
    expect(counts).toEqual({ [STUDENT_A]: 1 });
  });

  it('承認済み (通知がアーカイブ畝に付け替わった) の報告は、is_approved が false でも数えない', () => {
    const counts = countUnreadJournalsByStudent([
      harvest({ bed_id: 'archived_bed_A1_1_x', farm_beds: { status: 'archived' } }),
    ]);
    expect(counts).toEqual({});
  });

  it('差し戻し済みの報告は数えない', () => {
    const counts = countUnreadJournalsByStudent([harvest({ farm_beds: { status: 'rejected' } })]);
    expect(counts).toEqual({});
  });

  it('再申請で同じ畝に報告が複数あっても、承認待ちの畝ごとに 1 件だけ数える', () => {
    const counts = countUnreadJournalsByStudent([
      harvest({ farm_beds: { status: 'completed_pending' } }),
      harvest({ farm_beds: { status: 'completed_pending' } }),
      harvest({ bed_id: 'bed-2', farm_beds: { status: 'completed_pending' } }),
    ]);
    expect(counts).toEqual({ [STUDENT_A]: 2 });
  });

  it('講師が返信済みの報告は、承認待ちでも数えない', () => {
    const counts = countUnreadJournalsByStudent([
      harvest({ reply: 'お疲れさまでした', farm_beds: { status: 'completed_pending' } }),
    ]);
    expect(counts).toEqual({});
  });

  it('畝との紐付けが無い報告 (旧形式・区画の入れ替え後) は数えない', () => {
    const counts = countUnreadJournalsByStudent([
      harvest({ bed_id: null, farm_beds: null }),
      harvest({ bed_id: 'deleted-bed', farm_beds: null }),
    ]);
    expect(counts).toEqual({});
  });

  it('収穫完了報告と通常の日誌が混在しても、通常の日誌の数え方は変わらない', () => {
    const counts = countUnreadJournalsByStudent([
      journal({}),
      harvest({ farm_beds: { status: 'archived' } }),
      harvest({ bed_id: 'bed-2', farm_beds: { status: 'completed_pending' } }),
      journal({ student_id: STUDENT_B, reply: '返信済み' }),
    ]);
    expect(counts).toEqual({ [STUDENT_A]: 2 });
  });
});
