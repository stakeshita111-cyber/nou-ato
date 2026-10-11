import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      // AST-level security & architectural boundary rules
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='localStorage'][arguments.0.value=/.*(ticket|ai_usage|user_role).*/i]",
          message:
            'Security/SSOT violation: Critical business entities (tickets, usage, roles) must be persisted in Supabase DB, not localStorage.',
        },
      ],
    },
  },
  // API ルート以外のフロントエンドコードでサーバー秘密環境変数の参照を禁止
  {
    files: [
      'components/**/*.{ts,tsx}',
      'hooks/**/*.{ts,tsx}',
      'store/**/*.{ts,tsx}',
      'context/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/(SERVICE_ROLE|JWT_SECRET|GEMINI_API_KEY|LINE_CHANNEL_SECRET)/]",
          message: 'Security leak: Server secret keys must not be accessed in client-side code.',
        },
        {
          selector:
            "CallExpression[callee.object.name='localStorage'][arguments.0.value=/.*(ticket|ai_usage|user_role).*/i]",
          message:
            'Security/SSOT violation: Critical business entities must be persisted in Supabase DB, not localStorage.',
        },
      ],
    },
  },
  // RAG / AI ナレッジ検索層における Supabase シングルトン / ブラウザクライアント import の物理禁止
  {
    files: ['lib/rag/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/supabase',
              message:
                'Architectural violation: lib/rag must receive SupabaseClient via argument injection (db: SupabaseClient) to preserve auth context and RLS.',
            },
            {
              name: '@/utils/supabase/client',
              message:
                'Architectural violation: lib/rag must not import browser client. Inject the authenticated server client instead.',
            },
          ],
        },
      ],
    },
  },
  // eslint-comments: directive コメントの厳格管理
  {
    plugins: {
      '@eslint-community/eslint-comments': eslintComments,
    },
    rules: {
      '@eslint-community/eslint-comments/no-use': [
        'error',
        { allow: ['eslint-disable-next-line', 'eslint-disable-line'] },
      ],
      '@eslint-community/eslint-comments/require-description': [
        'error',
        { ignore: ['eslint-disable-next-line', 'eslint-disable-line'] },
      ],
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
      '@eslint-community/eslint-comments/disable-enable-pair': 'error',
    },
  },
  // 型付きLint段階導入 (未是正ファイルは ignores で段階移行)
  {
    files: [
      'app/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'hooks/**/*.{ts,tsx}',
      'store/**/*.{ts,tsx}',
      'lib/**/*.{ts,tsx}',
      'utils/**/*.{ts,tsx}',
      'context/**/*.{ts,tsx}',
    ],
    ignores: [
      'test/**',
      'app/api/chat/rag/route.ts',
      'app/student/page.tsx',
      'components/student/StudentTalkView.tsx',
      'components/teacher/TeacherFarmCanvasView.tsx',
      'components/teacher/TeacherJournalsView.tsx',
      'components/teacher/TeacherSettingsView.tsx',
      'components/ui/weather/useWeatherLive.ts',
      'hooks/useEvents.ts',
      'hooks/useFarmManager.ts',
      'hooks/useKanbanBoard.ts',
      'hooks/useStudentDashboard.ts',
      'lib/ticketManager.ts',
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'scratch/**', 'coverage/**']),
]);

export default eslintConfig;
