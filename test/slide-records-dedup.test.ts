import { describe, it, expect } from 'vitest';

interface SlideItemRecord {
  id: string;
  studentName: string;
  title: string;
  content: string;
  imageUrl?: string;
  dateStr: string;
  timeStr: string;
  timestamp: number;
  harvestAmount?: string;
}

function mergeSlideRecords(allRecords: SlideItemRecord[]): SlideItemRecord[] {
  allRecords.sort((a, b) => b.timestamp - a.timestamp);

  const mergedRecordsMap = new Map<string, SlideItemRecord>();

  allRecords.forEach((r) => {
    const normalizedContent = (r.content || '').trim().replace(/\s+/g, ' ');
    const isDefaultCompletionText =
      !normalizedContent ||
      normalizedContent === '作業を完了しました。' ||
      normalizedContent === '作業を完了しました' ||
      normalizedContent === '（コメントなし）';

    let groupKey = '';
    if (r.imageUrl && r.imageUrl.trim() && r.imageUrl.startsWith('http')) {
      groupKey = `img_${r.studentName}_${r.imageUrl.trim()}`;
    } else if (isDefaultCompletionText) {
      groupKey = `default_${r.studentName}_${r.dateStr}`;
    } else if (normalizedContent.length > 0 && normalizedContent.length <= 60) {
      groupKey = `content_${r.studentName}_${r.dateStr}_${normalizedContent}`;
    } else {
      groupKey = `id_${r.id || `${r.studentName}_${r.dateStr}_${r.timeStr}_${r.title}`}`;
    }

    if (!mergedRecordsMap.has(groupKey)) {
      mergedRecordsMap.set(groupKey, { ...r });
    } else {
      const existing = mergedRecordsMap.get(groupKey)!;

      const existingParts = existing.title.split(',').map((t) => t.trim());
      const newParts = r.title.split(',').map((t) => t.trim());
      const mergedTitles = Array.from(new Set([...existingParts, ...newParts])).filter(Boolean);

      if (mergedTitles.length > 2) {
        existing.title = `${mergedTitles[0]} 他${mergedTitles.length - 1}件`;
      } else {
        existing.title = mergedTitles.join(', ');
      }

      if (!existing.imageUrl && r.imageUrl) {
        existing.imageUrl = r.imageUrl;
      }

      if (
        (!existing.content || existing.content === '作業を完了しました。') &&
        r.content &&
        r.content !== '作業を完了しました。'
      ) {
        existing.content = r.content;
      }

      if (!existing.harvestAmount && r.harvestAmount) {
        existing.harvestAmount = r.harvestAmount;
      }
    }
  });

  return Array.from(mergedRecordsMap.values());
}

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
