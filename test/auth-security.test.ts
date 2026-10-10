import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { sanitizeNextUrl } from '@/app/auth/callback/route';

// -----------------------------------------------------------------------------
// モック管理: 本物の proxy.ts (Next.js Middleware) を直撃テストするための Supabase モック
// -----------------------------------------------------------------------------
let mockUser: { id: string; email?: string } | null = null;
let mockRole: 'teacher' | 'student' | null = null;
let mockAuthError: Error | null = null;

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => {
        if (mockAuthError) {
          return { data: { user: null }, error: mockAuthError };
        }
        return { data: { user: mockUser }, error: null };
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => {
                if (!mockUser) return { data: null, error: null };
                return { data: { role: mockRole }, error: null };
              }),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
      };
    }),
  })),
}));

describe('Security & Authorization Suite (本番コード直撃セキュリティ統合テスト)', () => {
  beforeEach(() => {
    mockUser = null;
    mockRole = null;
    mockAuthError = null;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  // ===========================================================================
  // 1. 本物の proxy.ts (Next.js Middleware) を直接呼び出す認可テスト
  // ===========================================================================
  describe('1. 本番 Middleware (proxy.ts) の厳格アクセス制御', () => {
    it('未ログインユーザーが講師画面 (/teacher/dashboard) にアクセスした場合、/login?redirect=... へ 307 リダイレクトされること', async () => {
      mockUser = null;
      const request = new NextRequest('http://localhost:3000/teacher/dashboard');
      const response = await proxy(request);

      expect(response.status).toBe(307);
      const redirectLocation = response.headers.get('location');
      expect(redirectLocation).toBe('http://localhost:3000/login?redirect=%2Fteacher%2Fdashboard');
    });

    it('未ログインユーザーが受講生画面 (/student) にアクセスした場合、/login?redirect=... へ 307 リダイレクトされること', async () => {
      mockUser = null;
      const request = new NextRequest('http://localhost:3000/student');
      const response = await proxy(request);

      expect(response.status).toBe(307);
      const redirectLocation = response.headers.get('location');
      expect(redirectLocation).toBe('http://localhost:3000/login?redirect=%2Fstudent');
    });

    it('未ログインユーザーがトップページ (/) にアクセスした場合、/login へリダイレクトされること', async () => {
      mockUser = null;
      const request = new NextRequest('http://localhost:3000/');
      const response = await proxy(request);

      expect(response.status).toBe(307);
      const redirectLocation = response.headers.get('location');
      expect(redirectLocation).toBe('http://localhost:3000/login');
    });

    it('生徒ロールのユーザーが講師画面 (/teacher/dashboard) へ不正アクセスを試みた場合、即座に /student へ強制送還されること (TC-AUTH-003)', async () => {
      mockUser = { id: 'student-uuid-001', email: 'student@example.com' };
      mockRole = 'student';

      const request = new NextRequest('http://localhost:3000/teacher/dashboard');
      const response = await proxy(request);

      expect(response.status).toBe(307);
      const redirectLocation = response.headers.get('location');
      expect(redirectLocation).toBe('http://localhost:3000/student');
    });

    it('講師ロールのユーザーが講師画面 (/teacher/dashboard) にアクセスした場合、リダイレクトされず通過 (200 OK) すること', async () => {
      mockUser = { id: 'teacher-uuid-001', email: 'teacher@example.com' };
      mockRole = 'teacher';

      const request = new NextRequest('http://localhost:3000/teacher/dashboard');
      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    });
  });

  // ===========================================================================
  // 2. 実マイグレーションSQLの解析・検証 (権限昇格・トリガー・SECURITY DEFINER)
  // ===========================================================================
  describe('2. DBマイグレーションによる権限昇格 (Privilege Escalation) 物理遮断の検証', () => {
    const migrationFile = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '20261009040000_prevent_privilege_escalation.sql'
    );
    const sqlContent = fs.readFileSync(migrationFile, 'utf-8');

    it("handle_new_auth_user() トリガー関数で raw_user_meta_data の role を無視し、常に role='student', farm_id=NULL で固定 INSERT していること", () => {
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.handle_new_auth_user()');
      expect(sqlContent).toMatch(/INSERT\s+INTO\s+public\.users\s*\([^)]*role[^)]*farm_id[^)]*\)/i);
      expect(sqlContent).toMatch(/'student'/);
      expect(sqlContent).toContain('DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;');
      expect(sqlContent).toMatch(
        /CREATE\s+TRIGGER\s+on_auth_user_created\s+AFTER\s+INSERT\s+ON\s+auth\.users/i
      );
    });

    it('prevent_user_role_and_farm_id_update() トリガーが authenticated および anon による直接更新を厳密に拒否すること', () => {
      expect(sqlContent).toContain(
        'CREATE OR REPLACE FUNCTION public.prevent_user_role_and_farm_id_update()'
      );
      expect(sqlContent).toMatch(/IF\s+current_user\s+IN\s*\('authenticated',\s*'anon'\)\s+THEN/i);
      expect(sqlContent).toContain(
        "RAISE EXCEPTION 'Permission denied: Cannot update role or farm_id directly'"
      );
      expect(sqlContent).toMatch(
        /CREATE\s+TRIGGER\s+trg_prevent_user_role_farm_update\s+BEFORE\s+UPDATE\s+ON\s+public\.users/i
      );
    });

    it('特権昇格関数 register_teacher が SECURITY DEFINER かつ SET search_path = public で安全に定義されていること', () => {
      expect(sqlContent).toMatch(
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.register_teacher\s*\([^)]*\)/i
      );
      expect(sqlContent).toContain('SECURITY DEFINER');
      expect(sqlContent).toContain('SET search_path = public');
      expect(sqlContent).toMatch(/UPDATE\s+public\.users\s+SET\s+role\s*=\s*'teacher'/i);
    });

    it('農園参加関数 join_farm が SECURITY DEFINER かつ SET search_path = public で安全に定義されていること', () => {
      expect(sqlContent).toMatch(
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.join_farm\s*\([^)]*\)/i
      );
      expect(sqlContent).toContain('SECURITY DEFINER');
      expect(sqlContent).toContain('SET search_path = public');
      expect(sqlContent).toMatch(/UPDATE\s+public\.users\s+SET\s+farm_id\s*=\s*found_farm_id/i);
    });
  });

  // ===========================================================================
  // 3. 本物の sanitizeNextUrl 関数のオープンリダイレクト脆弱性検証
  // ===========================================================================
  describe('3. OAuth コールバック URL サニタイズ (sanitizeNextUrl)', () => {
    it('正常な相対パス (/student, /teacher/dashboard) はそのまま許可されること', () => {
      expect(sanitizeNextUrl('/student')).toBe('/student');
      expect(sanitizeNextUrl('/teacher/dashboard')).toBe('/teacher/dashboard');
      expect(sanitizeNextUrl('/student/quests?tab=active')).toBe('/student/quests?tab=active');
    });

    it('絶対URL (https://evil.com) によるオープンリダイレクト攻撃は遮断されフォールバックすること', () => {
      expect(sanitizeNextUrl('https://evil.com')).toBe('/student');
      expect(sanitizeNextUrl('http://attacker.com/malicious')).toBe('/student');
    });

    it('プロトコル相対URL (//evil.com, /\\evil.com) は遮断されフォールバックすること', () => {
      expect(sanitizeNextUrl('//evil.com')).toBe('/student');
      expect(sanitizeNextUrl('/\\evil.com')).toBe('/student');
    });

    it('URLエンコードされた不正パス (%2f%2fevil.com) はデコード後に遮断されること', () => {
      expect(sanitizeNextUrl('%2f%2fevil.com')).toBe('/student');
    });

    it('スキームを含む不正パス (/http:evil.com, /javascript:alert(1)) は遮断されること', () => {
      expect(sanitizeNextUrl('/http:evil.com')).toBe('/student');
      expect(sanitizeNextUrl('/javascript:alert(1)')).toBe('/student');
    });

    it('null や空文字の場合は安全なデフォルト値を返すこと', () => {
      expect(sanitizeNextUrl(null)).toBe('/student');
      expect(sanitizeNextUrl('')).toBe('/student');
      expect(sanitizeNextUrl(null, '/teacher/dashboard')).toBe('/teacher/dashboard');
    });
  });

  // ===========================================================================
  // 4. Supabase スキーマの Security Invoker & RLS 適合性検証
  // ===========================================================================
  describe('4. Supabase スキーマの Security Invoker & RLS 適合性検証', () => {
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    const combinedContent = files
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n');

    it('マイグレーションで定義された全テーブルに漏れなく ENABLE ROW LEVEL SECURITY (RLS) が適用されていること', () => {
      const cleanSql = combinedContent.replace(/--.*$/gm, '');
      const tableMatches = [
        ...cleanSql.matchAll(
          /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi
        ),
      ];
      const allDetectedTables = [...new Set(tableMatches.map((m) => m[1]))];

      expect(allDetectedTables.length).toBeGreaterThanOrEqual(10);

      for (const table of allDetectedTables) {
        const hasRls = new RegExp(
          `ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?(?:public\\.)?${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
          'i'
        ).test(cleanSql);
        expect(
          hasRls,
          `テーブル '${table}' に ENABLE ROW LEVEL SECURITY が設定されていません`
        ).toBe(true);
      }
    });

    it('ビュー farm_beds_with_students に security_invoker = true が設定されていること', () => {
      const hasSecurityInvoker =
        combinedContent.includes('farm_beds_with_students') &&
        combinedContent.includes('security_invoker = true');
      expect(hasSecurityInvoker).toBe(true);
    });

    it('セキュリティ重要マイグレーション内の SECURITY DEFINER 関数に search_path = public が指定されていること', () => {
      const targetMigration = path.join(
        process.cwd(),
        'supabase',
        'migrations',
        '20261009040000_prevent_privilege_escalation.sql'
      );
      const rawSql = fs.readFileSync(targetMigration, 'utf-8');
      // コメント行 (-- ...) を除外した純粋なSQL構文から抽出
      const cleanSql = rawSql.replace(/--.*$/gm, '');
      const definerCount = (cleanSql.match(/\bSECURITY\s+DEFINER\b/gi) || []).length;
      const searchPathCount = (cleanSql.match(/SET\s+search_path\s*=\s*public/gi) || []).length;
      expect(definerCount).toBeGreaterThanOrEqual(3);
      expect(searchPathCount).toBeGreaterThanOrEqual(definerCount);
    });
  });
});
