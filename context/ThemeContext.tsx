'use client';

import React, { createContext, useContext } from 'react';

import { useThemeStore } from '@/store/useThemeStore';

export type ThemeColor = 'pistachio' | 'strawberry' | 'sapphire' | 'citrus';
export type FontSize = 'normal' | 'large' | 'xlarge';

interface ThemeContextType {
  themeColor: ThemeColor;
  fontSize: FontSize;
  applyTheme: (color: ThemeColor, size: FontSize) => void;
}

const colorHexMap: Record<ThemeColor, { primary: string; secondary: string }> = {
  pistachio: { primary: '#10b981', secondary: '#f59e0b' },
  strawberry: { primary: '#d8527c', secondary: '#f59e0b' },
  sapphire: { primary: '#3182ce', secondary: '#f59e0b' },
  citrus: { primary: '#e06d2d', secondary: '#f59e0b' },
};

const ThemeContext = createContext<ThemeContextType>({
  themeColor: 'pistachio',
  fontSize: 'normal',
  applyTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { settings, updateSettings } = useThemeStore();

  const getThemeColorName = (color: string): ThemeColor => {
    if (color === '#e06d2d') return 'citrus';
    if (color === '#d8527c') return 'strawberry';
    if (color === '#3182ce') return 'sapphire';
    return 'pistachio';
  };

  const themeColor = getThemeColorName(settings.primaryColor);
  const fontSize: FontSize =
    settings.fontSize === 'small'
      ? 'normal'
      : settings.fontSize === 'large'
        ? 'large'
        : settings.fontSize === 'xlarge'
          ? 'xlarge'
          : 'normal';

  const applyTheme = (color: ThemeColor, size: FontSize) => {
    const hex = colorHexMap[color] || colorHexMap.pistachio;
    const storeSize = size === 'xlarge' ? 'xlarge' : size === 'large' ? 'large' : 'medium';
    updateSettings({
      primaryColor: hex.primary,
      secondaryColor: hex.secondary,
      fontSize: storeSize,
    });
  };

  return (
    <ThemeContext.Provider value={{ themeColor, fontSize, applyTheme }}>
      <div className={`theme-${themeColor} app-bg-main min-h-screen transition-all duration-300`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
