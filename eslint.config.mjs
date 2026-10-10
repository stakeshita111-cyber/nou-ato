import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'warn',
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
  // Override default ignores of eslint-config-next.
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'scratch/**']),
]);

export default eslintConfig;
