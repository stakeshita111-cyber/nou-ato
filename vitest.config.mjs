import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://rarwrsrmkubhcndfpokl.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_fxOlNtgJTxAZNzP6QxN-Uw_8SwxpgIe",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
