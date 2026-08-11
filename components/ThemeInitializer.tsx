'use client';

import { useDynamicTheme } from '@/hooks/useDynamicTheme';

export function ThemeInitializer() {
  useDynamicTheme();
  return null;
}
