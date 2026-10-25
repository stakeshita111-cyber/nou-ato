import { describe, it, expect } from 'vitest';
import { mergeSlideRecords, type SlideItemRecord } from '@/lib/utils/journalHelper';

describe('mergeSlideRecords (スライダー記録のスマート統合＆重複排除)', () => {
  it('同一生徒が同日に複数タスクを「作業を完了しました。」で完了した場合、1件に統合されタグがマージされること', () => {
    const records: SlideItemRecord[] = [
      {
        id: 'rec_1',
        studentName: '生徒1 (テスト11)',
        title: '【初回必須】キャベツ定植',
        content: '作業を完了しました。',
        dateStr: '10/07',
        timeStr: '22:33',
        timestamp: 1728307980000,
      },
      {
        id: 'rec_2',
        studentName: '生徒1 (テスト11)',
        title: '【外葉拡大】キャベツ追肥',
        content: '作業を完了しました。',
        dateStr: '10/07',
        timeStr: '22:33',
        timestamp: 1728307980000,
      },
    ];

    const result = mergeSlideRecords(records);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('【初回必須】キャベツ定植, 【外葉拡大】キャベツ追肥');
    expect(result[0].content).toBe('作業を完了しました。');
  });

  it('同一生徒が同一画像URLを持つ複数レコードを持つ場合、1枚の画像カードに統合されること', () => {
    const records: SlideItemRecord[] = [
      {
        id: 'rec_1',
        studentName: '生徒1',
        title: 'キャベツ観察1',
        content: '順調です',
        imageUrl: 'https://example.com/same_image.jpg',
        dateStr: '10/07',
        timeStr: '10:00',
        timestamp: 1728262800000,
      },
      {
        id: 'rec_2',
        studentName: '生徒1',
        title: 'キャベツ観察2',
        content: '順調です',
        imageUrl: 'https://example.com/same_image.jpg',
        dateStr: '10/07',
        timeStr: '10:05',
        timestamp: 1728263100000,
      },
    ];

    const result = mergeSlideRecords(records);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('キャベツ観察2, キャベツ観察1');
    expect(result[0].imageUrl).toBe('https://example.com/same_image.jpg');
  });

  it('異なる生徒または具体的な別内容の記録は統合されずそれぞれ保持されること', () => {
    const records: SlideItemRecord[] = [
      {
        id: 'rec_1',
        studentName: '生徒1',
        title: '水やり',
        content: 'たっぷり水をあげました。',
        dateStr: '10/07',
        timeStr: '09:00',
        timestamp: 1728259200000,
      },
      {
        id: 'rec_2',
        studentName: '生徒2',
        title: '除草',
        content: '雑草を抜きました。',
        dateStr: '10/07',
        timeStr: '09:30',
        timestamp: 1728261000000,
      },
    ];

    const result = mergeSlideRecords(records);
    expect(result).toHaveLength(2);
  });
});
