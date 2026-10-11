import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';

export interface ThemeSettings {
  // 1. カラー・文字サイズ
  primaryColor: string; // 農園のメインカラー（例：トマトレッド、キャベツグリーン）
  secondaryColor: string; // アクセントカラー
  fontSize: 'small' | 'medium' | 'large' | 'xlarge'; // 屋外用「極大」

  // 2. タイポグラフィ
  fontFamily: 'sans' | 'serif' | 'rounded'; // 視認性の高い丸ゴシック（rounded）
  fontWeight: 'normal' | 'medium' | 'bold'; // 日差しの反射に負けない極太フォント
  lineHeight: 'normal' | 'relaxed' | 'loose'; // 誤読を防ぐためのゆったり行間

  // 3. ボタン・インタラクション
  borderRadius: 'none' | 'md' | 'full'; // ボタン形状（四角、角丸、丸）
  buttonPadding: 'normal' | 'large'; // 手袋をしたままでも押しやすい「極大」サイズ
  outdoorHighContrast: boolean; // 日差しの白飛び防止用高コントラスト

  // 4. アプリ固有の表示形式
  dateFormat: 'slash' | 'japanese'; // 「2026/08/11」 or 「8月11日(火)」
  numberFormat: 'raw' | 'comma' | 'unit'; // 「1500」 or 「1,500」 or 「1,500g」

  // 5. 機能・画面表示ON/OFF設定
  showPaymentsMenu: boolean; // 講師画面: 収支シミュレーションメニューの表示ON/OFF (基本非表示)
  showStudentTalkTab: boolean; // 生徒画面: 相談・質問タブの表示ON/OFF
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
  outdoorHighContrast: false,
  dateFormat: 'japanese',
  numberFormat: 'unit',
  showPaymentsMenu: false, // 収支シミュレーションは基本非表示（設定でON可能）
  showStudentTalkTab: true,
};

const ThemeSettingsSchema = z.object({
  primaryColor: z.string(),
  secondaryColor: z.string(),
  fontSize: z.enum(['small', 'medium', 'large', 'xlarge']),
  fontFamily: z.enum(['sans', 'serif', 'rounded']),
  fontWeight: z.enum(['normal', 'medium', 'bold']),
  lineHeight: z.enum(['normal', 'relaxed', 'loose']),
  borderRadius: z.enum(['none', 'md', 'full']),
  buttonPadding: z.enum(['normal', 'large']),
  outdoorHighContrast: z.boolean(),
  dateFormat: z.enum(['slash', 'japanese']),
  numberFormat: z.enum(['raw', 'comma', 'unit']),
  showPaymentsMenu: z.boolean(),
  showStudentTalkTab: z.boolean(),
});

const BroadcastEventDataSchema = z.object({
  type: z.literal('SETTINGS_UPDATED'),
  settings: ThemeSettingsSchema,
});

const StorageStateSchema = z.object({
  state: z.object({
    settings: ThemeSettingsSchema,
  }),
});

let syncChannel: BroadcastChannel | null = null;
const getBroadcastChannel = () => {
  if (typeof window === 'undefined') return null;
  if (!syncChannel && typeof BroadcastChannel !== 'undefined') {
    try {
      syncChannel = new BroadcastChannel('nouato_settings_sync');
      syncChannel.onmessage = (event: MessageEvent<unknown>) => {
        const parsed = BroadcastEventDataSchema.safeParse(event.data);
        if (parsed.success) {
          useThemeStore.setState({ settings: parsed.data.settings });
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel sync init warning:', e);
    }
  }
  return syncChannel;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (newSettings) => {
        set((state) => {
          const next = { ...state.settings, ...newSettings };
          if (typeof window !== 'undefined') {
            try {
              if (newSettings.showStudentTalkTab !== undefined) {
                localStorage.setItem(
                  'nouato_show_student_talk_tab',
                  String(newSettings.showStudentTalkTab)
                );
              }
              if (newSettings.outdoorHighContrast !== undefined) {
                localStorage.setItem(
                  'nouato_outdoor_contrast',
                  String(newSettings.outdoorHighContrast)
                );
                document.documentElement.setAttribute(
                  'data-contrast',
                  newSettings.outdoorHighContrast ? 'high' : 'normal'
                );
              }
              const bc = getBroadcastChannel();
              if (bc) {
                bc.postMessage({ type: 'SETTINGS_UPDATED', settings: next });
              }
            } catch {}
            window.dispatchEvent(new CustomEvent('nouato_settings_updated', { detail: next }));
          }
          return { settings: next };
        });
      },
      resetSettings: () => {
        set(() => {
          const next = defaultSettings;
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('nouato_show_student_talk_tab', 'true');
              localStorage.setItem('nouato_outdoor_contrast', 'false');
              document.documentElement.setAttribute('data-contrast', 'normal');
              const bc = getBroadcastChannel();
              if (bc) {
                bc.postMessage({ type: 'SETTINGS_UPDATED', settings: next });
              }
            } catch {}
            window.dispatchEvent(new CustomEvent('nouato_settings_updated', { detail: next }));
          }
          return { settings: next };
        });
      },
    }),
    {
      name: 'nou-ato-theme-settings',
    }
  )
);

// クライアント側でのクロスブラウザ・タブ間ストレージ変更監視
if (typeof window !== 'undefined') {
  getBroadcastChannel();
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === 'nou-ato-theme-settings' && e.newValue) {
      try {
        const json: unknown = JSON.parse(e.newValue);
        const parsed = StorageStateSchema.safeParse(json);
        if (parsed.success) {
          useThemeStore.setState({ settings: parsed.data.state.settings });
        }
      } catch {}
    }
  });
}
