import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    env: {
      // 新環境: nou-ato DB2
      NEXT_PUBLIC_SUPABASE_URL: "https://xejkbgbfktvvcfehjwsg.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlamtiZ2Jma3R2dmNmZWhqd3NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNjgwNjksImV4cCI6MjEwNjc0NDA2OX0.Y0OhIrlizZczqdIPkmEex1UzsmKqj6IH4W3wHT8vuyg",
      // 旧環境 (バックアップ)
      // NEXT_PUBLIC_SUPABASE_URL: "https://rarwrsrmkubhcndfpokl.supabase.co",
      // NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_fxOlNtgJTxAZNzP6QxN-Uw_8SwxpgIe",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "lib/apiResponse.ts",
        "lib/logger.ts",
        "lib/ticketManager.ts",
        "lib/utils/formatHelper.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
