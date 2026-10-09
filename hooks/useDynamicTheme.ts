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
    let themeAttr = 'pistachio';
    if (settings.primaryColor === '#e06d2d') themeAttr = 'citrus';
    else if (settings.primaryColor === '#d8527c') themeAttr = 'strawberry';
    else if (settings.primaryColor === '#3182ce') themeAttr = 'sapphire';
    root.setAttribute('data-theme', themeAttr);
    root.setAttribute('data-font-size', settings.fontSize);

    // 文字サイズの適用（シニア向け「極大」に対応）
    // Tailwindの rem 基準を動的に拡大・縮小させるため html の fontSize 自体を変更
    const sizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px',
      xlarge: '22px',
    };
    const targetFontSize = sizeMap[settings.fontSize] || '16px';
    root.style.fontSize = targetFontSize;
    root.style.setProperty('--font-size-base', targetFontSize);

    // フォントファミリー（M PLUS Roundedなど）
    const familyMap = {
      sans: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      serif: 'Georgia, Cambria, "Hiragino Mincho ProN", "Yu Mincho", "Times New Roman", serif',
      rounded:
        '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", sans-serif',
    };
    const targetFontFamily = familyMap[settings.fontFamily] || familyMap.sans;
    root.style.setProperty('--font-family-base', targetFontFamily);
    root.style.fontFamily = targetFontFamily;

    // 文字の太さ（日差しの反射で見えなくなるのを防止）
    const weightMap = {
      normal: '400',
      medium: '500',
      bold: '700',
    };
    root.style.setProperty('--font-weight-base', weightMap[settings.fontWeight] || '500');
    root.setAttribute('data-font-weight', settings.fontWeight);

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
    root.setAttribute('data-radius', settings.borderRadius);

    // ボタンパディング（手袋用極大サイズ）
    const paddingMap = {
      normal: '8px 16px',
      large: '14px 28px',
    };
    root.style.setProperty('--button-padding', paddingMap[settings.buttonPadding] || '8px 16px');
    root.setAttribute('data-button-size', settings.buttonPadding);

    // 屋外高コントラストモード
    root.setAttribute('data-contrast', settings.outdoorHighContrast ? 'high' : 'normal');
  }, [settings]);
};
