import { describe, it, expect } from 'vitest';
import { teacherSignUpSchema } from '@/app/auth/signup/teacher/page';
import { inviteSignUpSchema } from '@/app/invite/page';

describe('Teacher Sign-up and Student Invite Zod Validation Suite (本番スキーマ直接検証)', () => {
  describe('1. 講師サインアップスキーマ (teacherSignUpSchema)', () => {
    it('正常な入力値でバリデーションが成功すること', () => {
      const result = teacherSignUpSchema.safeParse({
        farmName: 'あおぞら自然農園',
        teacherName: '佐藤 健一',
        email: 'teacher@example.com',
        password: 'securePassword123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.farmName).toBe('あおぞら自然農園');
        expect(result.data.teacherName).toBe('佐藤 健一');
        expect(result.data.email).toBe('teacher@example.com');
      }
    });

    it('農園名が空文字または空白のみの場合に拒否されること', () => {
      const result = teacherSignUpSchema.safeParse({
        farmName: '   ',
        teacherName: '佐藤 健一',
        email: 'teacher@example.com',
        password: 'securePassword123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('農場名を入力してください');
      }
    });

    it('講師名が空文字または空白のみの場合に拒否されること', () => {
      const result = teacherSignUpSchema.safeParse({
        farmName: 'あおぞら自然農園',
        teacherName: '   ',
        email: 'teacher@example.com',
        password: 'securePassword123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('講師名を入力してください');
      }
    });

    it('不正な形式のメールアドレスが拒否されること', () => {
      const invalidEmails = ['invalid-email', 'user@', '@example.com'];
      invalidEmails.forEach((email) => {
        const result = teacherSignUpSchema.safeParse({
          farmName: 'あおぞら自然農園',
          teacherName: '佐藤 健一',
          email,
          password: 'securePassword123',
        });
        expect(result.success).toBe(false);
      });
    });

    it('パスワードが6文字未満の場合に拒否されること', () => {
      const result = teacherSignUpSchema.safeParse({
        farmName: 'あおぞら自然農園',
        teacherName: '佐藤 健一',
        email: 'teacher@example.com',
        password: '12345',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('パスワードは6文字以上で入力してください');
      }
    });

    it('前後の余分な空白が自動トリムされること', () => {
      const result = teacherSignUpSchema.safeParse({
        farmName: '  あおぞら農園  ',
        teacherName: '  佐藤 健一  ',
        email: '  teacher@example.com  ',
        password: 'password123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.farmName).toBe('あおぞら農園');
        expect(result.data.teacherName).toBe('佐藤 健一');
        expect(result.data.email).toBe('teacher@example.com');
      }
    });
  });

  describe('2. 生徒招待サインアップスキーマ (inviteSignUpSchema)', () => {
    it('正常な入力値でバリデーションが成功すること', () => {
      const result = inviteSignUpSchema.safeParse({
        name: '山田 太郎',
        email: 'student@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('山田 太郎');
        expect(result.data.email).toBe('student@example.com');
      }
    });

    it('氏名が空文字または空白のみの場合に拒否されること', () => {
      const result = inviteSignUpSchema.safeParse({
        name: '   ',
        email: 'student@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('ユーザー名（お名前）を入力してください');
      }
    });

    it('メールアドレスが無効形式の場合に拒否されること', () => {
      const result = inviteSignUpSchema.safeParse({
        name: '山田 太郎',
        email: 'not-an-email',
        password: 'password123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('有効なメールアドレスを入力してください');
      }
    });

    it('パスワードが6文字未満の場合に拒否されること', () => {
      const result = inviteSignUpSchema.safeParse({
        name: '山田 太郎',
        email: 'student@example.com',
        password: '123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('パスワードは6文字以上で入力してください');
      }
    });
  });
});
