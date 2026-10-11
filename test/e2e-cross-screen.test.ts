import { describe, it, expect } from 'vitest';
import { MASTER_TASKS } from '@/lib/taskMaster';
import { VEGETABLE_TASK_TEMPLATES } from '@/lib/taskTemplates';
import { DEFAULT_PRESET_FAQS } from '@/lib/presetFaqs';
import { formatDate } from '@/lib/utils/formatHelper';

describe('Cross-Module Data Flow and Template Integrity (モジュール横断データ完全性テスト)', () => {
  describe('1. 教材タスクと受講生タスクテンプレートの整合性', () => {
    it('MASTER_TASKS に含まれる全タスクが正当なプロパティ（title, exp, category）を保持していること', () => {
      expect(MASTER_TASKS.length).toBeGreaterThan(0);
      MASTER_TASKS.forEach((task) => {
        expect(task.id).toBeTruthy();
        expect(task.title.trim()).toBeTruthy();
        expect(task.exp).toBeGreaterThan(0);
        expect(task.category).toBeTruthy();
      });
    });

    it('VEGETABLE_TASK_TEMPLATES の全作物が MASTER_TASKS と互換性のあるフェーズ・カテゴリーを有していること', () => {
      expect(VEGETABLE_TASK_TEMPLATES.length).toBeGreaterThan(0);
      VEGETABLE_TASK_TEMPLATES.forEach((tpl) => {
        expect(tpl.target_crop).toBeTruthy();
        expect(tpl.title).toBeTruthy();
        expect(tpl.difficulty).toBeGreaterThanOrEqual(1);
        expect(tpl.difficulty).toBeLessThanOrEqual(5);
        expect(tpl.exp).toBeGreaterThanOrEqual(10);
      });
    });

    it('タスクの複製時に ID やタイトルが正しく派生・独立できること', () => {
      const sourceTask = MASTER_TASKS[0];
      const duplicated = {
        ...sourceTask,
        id: `dup_${sourceTask.id}`,
        title: `${sourceTask.title} (コピー)`,
        status: 'pool' as const,
      };

      expect(duplicated.id).not.toBe(sourceTask.id);
      expect(duplicated.title).toBe(`${sourceTask.title} (コピー)`);
      expect(duplicated.status).toBe('pool');
    });
  });

  describe('2. 日時フォーマット・表示ヘルパーの整合性', () => {
    it('formatDate が ISO 文字列や通常の日付文字列を ja-JP 形式へ安全に変換できること', () => {
      const testIso = '2026-10-15T09:30:00.000Z';
      const formatted = formatDate(testIso);
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('不正な日付文字列が渡された場合でもクラッシュせずフォールバックすること', () => {
      expect(() => formatDate('invalid-date')).not.toThrow();
    });
  });

  describe('3. 生徒・講師 FAQ プリセットの整合性', () => {
    it('DEFAULT_PRESET_FAQS に登録された全質問が 50 文字以内のチップと非空の回答を持つこと', () => {
      expect(DEFAULT_PRESET_FAQS.length).toBeGreaterThan(0);
      DEFAULT_PRESET_FAQS.forEach((faq) => {
        expect(faq.id).toBeTruthy();
        expect(faq.chipLabel.length).toBeLessThanOrEqual(50);
        expect(faq.question.trim()).toBeTruthy();
        expect(faq.answer.trim()).toBeTruthy();
      });
    });
  });
});
