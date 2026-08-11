import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ThemeSettings {
  // 1. カラー・文字サイズ
  primaryColor: string;      // 農園のメインカラー（例：トマトレッド、キャベツグリーン）
  secondaryColor: string;    // アクセントカラー
  fontSize: 'small' | 'medium' | 'large' | 'xlarge'; // 屋外用「極大」

  // 2. タイポグラフィ
  fontFamily: 'sans' | 'serif' | 'rounded'; // 視認性の高い丸ゴシック（rounded）
  fontWeight: 'normal' | 'medium' | 'bold'; // 日差しの反射に負けない極太フォント
  lineHeight: 'normal' | 'relaxed' | 'loose'; // 誤読を防ぐためのゆったり行間

  // 3. ボタン・インタラクション
  borderRadius: 'none' | 'md' | 'full'; // ボタン形状（四角、角丸、丸）
  buttonPadding: 'normal' | 'large'; // 手袋をしたままでも押しやすい「極大」サイズ

  // 4. アプリ固有の表示形式
  dateFormat: 'slash' | 'japanese'; // 「2026/08/11」 or 「8月11日(火)」
  numberFormat: 'raw' | 'comma' | 'unit'; // 「1500」 or 「1,500」 or 「1,500g」
  politeStyle: 'polite' | 'shirube'; // AIしるべぇの口調（標準語 or ～べぇ！）
}

interface ThemeState {
  settings: ThemeSettings;
  updateSettings: (newSettings: Partial<ThemeSettings>) => void;
  resetSettings: () => void;
}

const defaultSettings: ThemeSettings = {
  primaryColor: '#10b981', // キャベツグリーン
  secondaryColor: '#f59e0b', // みかんオレンジ
  fontSize: 'medium',
  fontFamily: 'sans',
  fontWeight: 'medium',
  lineHeight: 'relaxed',
  borderRadius: 'md',
  buttonPadding: 'normal',
  dateFormat: 'japanese',
  numberFormat: 'unit',
  politeStyle: 'shirube',
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (newSettings) =>
        set((state) => ({ settings: { ...state.settings, ...newSettings } })),
      resetSettings: () => set({ settings: defaultSettings }),
    }),
    {
      name: 'nou-ato-theme-settings',
    }
  )
);
