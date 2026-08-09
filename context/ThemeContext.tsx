"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeColor = "pistachio" | "strawberry" | "sapphire" | "citrus";
export type FontSize = "normal" | "large" | "xlarge";

interface ThemeContextType {
  themeColor: ThemeColor;
  fontSize: FontSize;
  // 確定適用関数（「保存」ボタンを押した時に適用）
  applyTheme: (color: ThemeColor, size: FontSize) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeColor: "pistachio",
  fontSize: "normal",
  applyTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeColor, setThemeColorState] = useState<ThemeColor>("pistachio");
  const [fontSize, setFontSizeState] = useState<FontSize>("normal");

  // 初期読み込み (localStorage ＆ HTML属性反映)
  useEffect(() => {
    const savedTheme = localStorage.getItem("nouato_theme_color") as ThemeColor;
    const savedSize = localStorage.getItem("nouato_font_size") as FontSize;
    const savedContrast = localStorage.getItem("nouato_outdoor_contrast") === "true";

    if (savedTheme && ["pistachio", "strawberry", "sapphire", "citrus"].includes(savedTheme)) {
      setThemeColorState(savedTheme);
    }
    if (savedSize && ["normal", "large", "xlarge"].includes(savedSize)) {
      setFontSizeState(savedSize);
    }

    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-contrast", savedContrast ? "high" : "normal");
    }
  }, []);

  // 確定適用関数
  const applyTheme = (color: ThemeColor, size: FontSize) => {
    setThemeColorState(color);
    setFontSizeState(size);
    localStorage.setItem("nouato_theme_color", color);
    localStorage.setItem("nouato_font_size", size);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", color);
      document.documentElement.setAttribute("data-font-size", size);
    }
  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", themeColor);
      document.documentElement.setAttribute("data-font-size", fontSize);
    }
  }, [themeColor, fontSize]);

  return (
    <ThemeContext.Provider value={{ themeColor, fontSize, applyTheme }}>
      <div
        className={`theme-${themeColor} app-bg-main min-h-screen ${
          fontSize === "large"
            ? "text-[15px]"
            : fontSize === "xlarge"
            ? "text-[17px]"
            : "text-[14px]"
        } transition-all duration-300`}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
