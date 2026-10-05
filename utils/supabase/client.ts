import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://xejkbgbfktvvcfehjwsg.supabase.co";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlamtiZ2Jma3R2dmNmZWhqd3NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNjgwNjksImV4cCI6MjEwNjc0NDA2OX0.Y0OhIrlizZczqdIPkmEex1UzsmKqj6IH4W3wHT8vuyg";

  return createBrowserClient(url, anonKey);
}
