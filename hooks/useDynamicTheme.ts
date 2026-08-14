'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/store/useThemeStore';

export const useDynamicTheme = () => {
  const { settings } = useThemeStore();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    // カラー（CSS変数）の適用
    root.style.setProperty('--color-primary', settings.primaryColor);
    root.style.setProperty('--color-secondary', settings.secondaryColor);
    root.style.setProperty('--accent-main', settings.primaryColor);

    // テーマ属性の自動切り替え
    let themeAttr = "pistachio";
    if (settings.primaryColor === "#e06d2d") themeAttr = "citrus";
    else if (settings.primaryColor === "#d8527c") themeAttr = "strawberry";
    else if (settings.primaryColor === "#3182ce") themeAttr = "sapphire";
    root.setAttribute("data-theme", themeAttr);
    root.setAttribute("data-font-size", settings.fontSize);

    // 文字サイズの適用（シニア向け「極大」に対応）
    const sizeMap = {
      small: '14px',
      medium: '16px',
      large: '20px',
      xlarge: '24px',
    };
    root.style.setProperty('--font-size-base', sizeMap[settings.fontSize] || '16px');

    // フォントファミリー（M PLUS Roundedなど）
    const familyMap = {
      sans: 'var(--font-geist-sans), sans-serif',
      serif: 'var(--font-geist-serif), serif',
      rounded: '"M PLUS Rounded 1c", sans-serif',
    };
    root.style.setProperty('--font-family-base', familyMap[settings.fontFamily] || familyMap.sans);

    // 文字の太さ（日差しの反射で見えなくなるのを防止）
    const weightMap = {
      normal: '400',
      medium: '500',
      bold: '700',
    };
    root.style.setProperty('--font-weight-base', weightMap[settings.fontWeight] || '500');

    // 行間（誤読防止）
    const lineMap = {
      normal: '1.25',
      relaxed: '1.625',
      loose: '2.0',
    };
    root.style.setProperty('--line-height-base', lineMap[settings.lineHeight] || '1.625');

    // ボタン角丸
    const radiusMap = {
      none: '0px',
      md: '8px',
      full: '9999px',
    };
    root.style.setProperty('--border-radius-button', radiusMap[settings.borderRadius] || '8px');

    // ボタンパディング（手袋用極大サイズ）
    const paddingMap = {
      normal: '8px 16px',
      large: '16px 32px',
    };
    root.style.setProperty('--button-padding', paddingMap[settings.buttonPadding] || '8px 16px');

  }, [settings]);
};
