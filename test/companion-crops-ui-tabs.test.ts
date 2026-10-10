import { describe, it, expect } from 'vitest';
import {
  parseCrops,
  formatBedCropLabel,
  isRecordMatchingCrop,
} from '@/lib/farm/companionCropsHelper';
import { CropRecord } from '@/types/farm';

describe('混植（コンパニオンプランツ）UI・タブ絞り込み機能の検証', () => {
  describe('#1 畝ボタン表示 (formatBedCropLabel): 複数品種時に「きゅうり他2種」形式で表示', () => {
    it('1品種のみの場合はそのまま品種名を表示すること', () => {
      expect(formatBedCropLabel('きゅうり')).toBe('きゅうり');
      expect(formatBedCropLabel('ミニトマト')).toBe('ミニトマト');
    });

    it('2品種混植の場合は「1品目名他1種」と表示すること', () => {
      expect(formatBedCropLabel('きゅうり、バジル')).toBe('きゅうり他1種');
      expect(formatBedCropLabel('ミニトマト, バジル')).toBe('ミニトマト他1種');
    });

    it('3品種混植（夏野菜のきゅうり・ミニトマト・中玉トマト）で「きゅうり他2種」と表示すること', () => {
      expect(formatBedCropLabel('きゅうり、ミニトマト、中玉トマト')).toBe('きゅうり他2種');
    });

    it('未確定・未設定・空文字の場合はそのまま保持されること', () => {
      expect(formatBedCropLabel('未確定 🌱')).toBe('未確定 🌱');
      expect(formatBedCropLabel('')).toBe('未設定');
      expect(formatBedCropLabel(null)).toBe('未設定');
      expect(formatBedCropLabel(undefined)).toBe('未設定');
    });
  });

  describe('品種パース (parseCrops)', () => {
    it('全角「、」や半角カンマで区切られた品種を正しく分割できること', () => {
      expect(parseCrops('きゅうり、ミニトマト、中玉トマト')).toEqual([
        'きゅうり',
        'ミニトマト',
        '中玉トマト',
      ]);
      expect(parseCrops('きゅうり, ミニトマト, 中玉トマト')).toEqual([
        'きゅうり',
        'ミニトマト',
        '中玉トマト',
      ]);
    });

    it('未設定・未確定・全体共通時は空配列を返すこと', () => {
      expect(parseCrops('未確定 🌱')).toEqual([]);
      expect(parseCrops('全体共通')).toEqual([]);
      expect(parseCrops(null)).toEqual([]);
    });
  });

  describe('#2 品種タブ絞り込み (isRecordMatchingCrop)', () => {
    it('targetCrop が "all" の場合は常に true を返すこと', () => {
      expect(isRecordMatchingCrop('きゅうり', 'メモ', 'all')).toBe(true);
      expect(isRecordMatchingCrop('ミニトマト', 'メモ', 'all')).toBe(true);
    });

    it('crop_name が一致する場合に true を返すこと', () => {
      expect(isRecordMatchingCrop('きゅうり', '水やり', 'きゅうり')).toBe(true);
      expect(isRecordMatchingCrop('ミニトマト', '水やり', 'きゅうり')).toBe(false);
    });

    it('notes の【作目タグ】に合致する場合に true を返すこと', () => {
      expect(
        isRecordMatchingCrop('きゅうり、ミニトマト', '【ミニトマト】第一花房が開花', 'ミニトマト')
      ).toBe(true);
      expect(
        isRecordMatchingCrop('きゅうり、ミニトマト', '【きゅうり】つるの誘引', 'ミニトマト')
      ).toBe(false);
    });

    it('タイムラインの記録一覧から特定品種のみを正確に抽出できること', () => {
      const records: Partial<CropRecord>[] = [
        { id: '1', crop_name: 'きゅうり', notes: '【きゅうり】水やり' },
        { id: '2', crop_name: 'ミニトマト', notes: '【ミニトマト】わき芽かき' },
        { id: '3', crop_name: '中玉トマト', notes: '【中玉トマト】支柱立て' },
        { id: '4', crop_name: 'きゅうり', notes: '【きゅうり】収穫1本' },
      ];

      const cucumberRecs = records.filter((r) =>
        isRecordMatchingCrop(r.crop_name, r.notes, 'きゅうり')
      );
      const miniTomatoRecs = records.filter((r) =>
        isRecordMatchingCrop(r.crop_name, r.notes, 'ミニトマト')
      );
      const mediumTomatoRecs = records.filter((r) =>
        isRecordMatchingCrop(r.crop_name, r.notes, '中玉トマト')
      );

      expect(cucumberRecs.map((r) => r.id)).toEqual(['1', '4']);
      expect(miniTomatoRecs.map((r) => r.id)).toEqual(['2']);
      expect(mediumTomatoRecs.map((r) => r.id)).toEqual(['3']);
    });
  });

  describe('#3 観察記録モーダルでの品種入力・選択ロジック', () => {
    it('完全新規（品種未設定）の畝では登録品種候補が0件となり自由入力が促されること', () => {
      const bedCrops = parseCrops('未確定 🌱');
      expect(bedCrops).toHaveLength(0);
    });

    it('2回目以降（混植登録済み）の畝では登録品種チップの選択肢が生成されること', () => {
      const bedCrops = parseCrops('きゅうり、ミニトマト、中玉トマト');
      expect(bedCrops).toEqual(['きゅうり', 'ミニトマト', '中玉トマト']);
      expect(bedCrops).toContain('きゅうり');
      expect(bedCrops).toContain('ミニトマト');
      expect(bedCrops).toContain('中玉トマト');
    });

    it('生徒がチップから選択して記録保存した際、ノートに【選択した品種名】タグが付与されること', () => {
      const selectedCrop = 'ミニトマト';
      const userRawNotes = 'わき芽かきを実施しました。';
      const taggedNotes = `【${selectedCrop}】${userRawNotes}`;

      expect(taggedNotes).toBe('【ミニトマト】わき芽かきを実施しました。');
      expect(isRecordMatchingCrop(selectedCrop, taggedNotes, 'ミニトマト')).toBe(true);
      expect(isRecordMatchingCrop(selectedCrop, taggedNotes, 'きゅうり')).toBe(false);
    });
  });
});
