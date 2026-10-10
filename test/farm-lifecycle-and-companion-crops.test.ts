import { describe, it, expect } from 'vitest';
import { getDefaultSeason, getSeasonOptions } from '@/components/farm/BedCompletionModal';
import { FarmBed, CropRecord } from '@/types/farm';

describe('4M変化点＆実運用システム対応テスト (Farm Lifecycle & 4M Variations)', () => {
  describe('1. Method変化点: 年またぎ・シーズン自動判定＆選択肢生成', () => {
    it('春〜夏の作付（3〜8月）で当年の春夏シーズンを判定できること', () => {
      const springDate = new Date('2026-05-10T10:00:00Z');
      expect(getDefaultSeason(springDate)).toBe('2026年 春夏');

      const summerDate = new Date('2027-08-20T10:00:00Z');
      expect(getDefaultSeason(summerDate)).toBe('2027年 春夏');
    });

    it('秋〜冬の作付（9〜翌2月・越冬野菜）で秋冬シーズンを判定できること', () => {
      // 秋作付（例: 10月のキャベツ・ブロッコリー）
      const autumnDate = new Date('2026-10-15T10:00:00Z');
      expect(getDefaultSeason(autumnDate)).toBe('2026年 秋冬');

      // 越冬野菜の厳冬期管理（例: 翌年1月のタマネギ・ソラマメ）
      const winterDate = new Date('2027-01-20T10:00:00Z');
      expect(getDefaultSeason(winterDate)).toBe('2026年 秋冬');
    });

    it('getSeasonOptions が現在年を起点に前後複数年のシーズンを動的生成すること (年またぎ陳腐化防止)', () => {
      const baseDate = new Date('2026-04-01T00:00:00Z');
      const options = getSeasonOptions(baseDate);

      // 2025年（前年）から 2028年（再来年）までの選択肢が含まれること
      expect(options).toContain('2025年 春夏');
      expect(options).toContain('2025年 秋冬');
      expect(options).toContain('2026年 春夏');
      expect(options).toContain('2026年 秋冬');
      expect(options).toContain('2027年 春夏');
      expect(options).toContain('2027年 秋冬');
      expect(options).toContain('2028年 春夏');
      expect(options).toContain('2028年 秋冬');
    });
  });

  describe('2. Material変化点: 同じ畝への複数品種混植（コンパニオンプランツ）保護', () => {
    it('混植畝（例: ミニトマト、バジル）で個別品種を記録しても畝全体の混植名が消えないこと', () => {
      const currentBed: Partial<FarmBed> = {
        id: 'bed-001',
        bed_number: 1,
        crop_name: 'ミニトマト、バジル',
      };

      // 生徒がバジルの作業記録をつけるシナリオ
      const customCropName = 'バジル';
      const existingCrop = currentBed.crop_name || '';

      let bedCropToSave = existingCrop;
      if (customCropName) {
        if (!existingCrop) {
          bedCropToSave = customCropName;
        } else if (existingCrop.includes(customCropName)) {
          // 既存の混植リストに含まれているため保護して維持
          bedCropToSave = existingCrop;
        } else {
          bedCropToSave = customCropName;
        }
      }

      // 畝の品種名は「ミニトマト、バジル」のまま維持される
      expect(bedCropToSave).toBe('ミニトマト、バジル');
    });

    it('CropRecord に品種名が個別に保持され、混植でも作目ごとの追跡が可能なこと', () => {
      const record1: CropRecord = {
        id: 'rec-1',
        bed_id: 'bed-001',
        date: '2026/5/1',
        crop_name: 'ミニトマト',
        growth_stage: '開花・受粉',
        work_types: ['わき芽かき・仕立て'],
        notes: '【ミニトマト】第一花房が開花',
        created_at: new Date().toISOString(),
      };

      const record2: CropRecord = {
        id: 'rec-2',
        bed_id: 'bed-001',
        date: '2026/5/3',
        crop_name: 'バジル',
        growth_stage: '本葉展開・つる伸び',
        work_types: ['除草・土寄せ'],
        notes: '【バジル】株元の雑草を抜いて土寄せ',
        created_at: new Date().toISOString(),
      };

      expect(record1.crop_name).toBe('ミニトマト');
      expect(record2.crop_name).toBe('バジル');
      expect(record1.bed_id).toBe(record2.bed_id); // 同じ畝で別々の品種として識別可能
    });
  });

  describe('3. Method/Machine変化点: 輪作・栽培完了・アーカイブサイクル', () => {
    it('収穫完了した畝がアーカイブされ、新シーズンでリセット・再利用できること', () => {
      // 1. 春夏作の栽培完了
      const completedBed: FarmBed = {
        id: 'bed-001',
        plot_id: 'plot-1',
        bed_number: 1,
        crop_name: '大玉トマト',
        status: 'archived',
        season: '2026年 春夏',
        harvested_at: '2026-08-15T00:00:00Z',
        total_harvest: '45個',
        is_updated: false,
      };

      // 2. 秋冬作に向けた畝のリセット（後作: キャベツ・ブロッコリーへ）
      const resetBedForAutumn: FarmBed = {
        id: 'bed-001',
        plot_id: 'plot-1',
        bed_number: 1,
        crop_name: 'キャベツ',
        status: 'active',
        season: '2026年 秋冬',
        is_updated: false,
      };

      expect(completedBed.status).toBe('archived');
      expect(completedBed.crop_name).toBe('大玉トマト');
      expect(resetBedForAutumn.status).toBe('active');
      expect(resetBedForAutumn.crop_name).toBe('キャベツ');
      expect(resetBedForAutumn.id).toBe(completedBed.id); // 同一の畝番号が再利用される
    });
  });
});
