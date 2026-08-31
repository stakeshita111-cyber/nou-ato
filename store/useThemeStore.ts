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

  // 5. 機能・画面表示ON/OFF設定
  showPaymentsMenu: boolean;     // 講師画面: 売上画面メニューの表示ON/OFF
  showStudentTalkTab: boolean;   // 生徒画面: 相談・質問タブの表示ON/OFF
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
  showPaymentsMenu: true,
  showStudentTalkTab: true,
};

let syncChannel: BroadcastChannel | null = null;
const getBroadcastChannel = () => {
  if (typeof window === 'undefined') return null;
  if (!syncChannel && typeof BroadcastChannel !== 'undefined') {
    try {
      syncChannel = new BroadcastChannel('nouato_settings_sync');
      syncChannel.onmessage = (event) => {
        if (event.data?.type === 'SETTINGS_UPDATED' && event.data?.settings) {
          useThemeStore.setState({ settings: event.data.settings });
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
                localStorage.setItem('nouato_show_student_talk_tab', String(newSettings.showStudentTalkTab));
              }
              const bc = getBroadcastChannel();
              if (bc) {
                bc.postMessage({ type: 'SETTINGS_UPDATED', settings: next });
              }
            } catch (e) {}
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
              const bc = getBroadcastChannel();
              if (bc) {
                bc.postMessage({ type: 'SETTINGS_UPDATED', settings: next });
              }
            } catch (e) {}
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
  window.addEventListener('storage', (e) => {
    if (e.key === 'nou-ato-theme-settings' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed.state?.settings) {
          useThemeStore.setState({ settings: parsed.state.settings });
        }
      } catch (err) {}
    }
  });
}
