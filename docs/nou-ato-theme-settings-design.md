# 『のうあと（NOU-ATO）』UI/UXテーマ・表示形式カスタマイズ設計書

本設計書は、体験農業経営支援アプリ『のうあと（NOU-ATO）』における、農園主（Teacher）および生徒（Student）画面のUI/UXを劇的に改善し、現場（畑）の様々なペイン（日差しによる画面反射、シニア農家の目の疲れ、手袋をしたままでの誤操作、しるべぇの口調切替など）に対応するためのフロントエンド実装設計書です。

既存のMUI（Material-UI）前提だったプロンプトを、現在のプロジェクト技術スタックである **Next.js (App Router) + Tailwind CSS + shadcn/ui** に完全適合させ、Zustandを用いた即時反映・型安全な構成に昇華させました。

---

## 📅 1. 必要なファイル構成案

```text
farm-management-app/
├── store/
│   └── useThemeStore.ts               # Zustandによるテーマ状態の保持（LocalStorage永続化）
├── hooks/
│   └── useDynamicTheme.ts             # Tailwind CSSのカスタム変数を動的に書き換えるフック
├── lib/
│   └── utils/
│       └── formatHelper.ts            # 日付・数値フォーマット、しるべぇ文体の変換ユーティリティ
├── app/
│   ├── globals.css                    # Tailwind CSS変数とベーススタイルの定義（フォーカスリング等）
│   ├── layout.tsx                     # useDynamicThemeを適用するグローバルレイアウト
│   ├── settings/
│   │   └── page.tsx                   # 新規設定画面（MUIからshadcn/ui・Tailwindに移植）
│   ├── teacher/
│   │   └── dashboard/
│   │       └── page.tsx               # 設定値がリアルタイム反映されるTeacher画面例
│   └── student/
│       └── quests/
│           └── page.tsx               # 設定値がリアルタイム反映されるStudent画面例
```

---

## 📄 2. 実装コード一式

### ① Zustand 設定管理コード (`store/useThemeStore.ts`)
既存の設定（カラー・サイズ）と、追加したいアクセシビリティ項目（手袋対応・日差し対策等）を統合したストアです。

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ThemeSettings {
  // 1. カラー・文字サイズ（既存＋拡張）
  primaryColor: string;      // 農園のメインカラー（例：トマトレッド、キャベツグリーン）
  secondaryColor: string;    // アクセントカラー
  fontSize: 'small' | 'medium' | 'large' | 'xlarge'; // 屋外用「極大」を追加（シニア農家推奨）

  // 2. タイポグラフィ（新規追加）
  fontFamily: 'sans' | 'serif' | 'rounded'; // 視認性の高い丸ゴシック（rounded）を追加
  fontWeight: 'normal' | 'medium' | 'bold'; // 日差しの反射に負けない極太フォント
  lineHeight: 'normal' | 'relaxed' | 'loose'; // 誤読を防ぐためのゆったり行間

  // 3. ボタン・インタラクション（新規追加）
  borderRadius: 'none' | 'md' | 'full'; // ボタン形状（四角、角丸、丸）
  buttonPadding: 'normal' | 'large'; // 手袋をしたままでも押しやすい「極大」サイズ

  // 4. アプリ固有の表示形式（新規追加）
  dateFormat: 'slash' | 'japanese'; // 「2026/08/11」 or 「8月11日(火)」
  numberFormat: 'raw' | 'comma' | 'unit'; // 「1500」 or 「1,500」 or 「1,500g / 1,500円」
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
```

### ② Tailwind CSS変数 動的適用フック (`hooks/useDynamicTheme.ts`)
createTheme の代わりに、CSS Custom Propertiesを操作します。Next.jsのSSR/SSGでもハイドレーションエラーを起こさないクリーンな仕組みです。

```typescript
'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/store/useThemeStore';

export const useDynamicTheme = () => {
  const { settings } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;

    // カラー（CSS変数）の適用
    root.style.setProperty('--color-primary', settings.primaryColor);
    root.style.setProperty('--color-secondary', settings.secondaryColor);

    // 文字サイズの適用（シニア向け「極大」に対応）
    const sizeMap = {
      small: '14px',
      medium: '16px',
      large: '20px',
      xlarge: '24px',
    };
    root.style.setProperty('--font-size-base', sizeMap[settings.fontSize]);

    // フォントファミリー（M PLUS Roundedなど）
    const familyMap = {
      sans: 'var(--font-geist-sans), sans-serif',
      serif: 'var(--font-geist-serif), serif',
      rounded: '"M PLUS Rounded 1c", sans-serif',
    };
    root.style.setProperty('--font-family-base', familyMap[settings.fontFamily]);

    // 文字の太さ（日差しの反射で見えなくなるのを防止）
    const weightMap = {
      normal: '400',
      medium: '500',
      bold: '700',
    };
    root.style.setProperty('--font-weight-base', weightMap[settings.fontWeight]);

    // 行間（誤読防止）
    const lineMap = {
      normal: '1.25',
      relaxed: '1.625',
      loose: '2.0',
    };
    root.style.setProperty('--line-height-base', lineMap[settings.lineHeight]);

    // ボタン角丸
    const radiusMap = {
      none: '0px',
      md: '8px',
      full: '9999px',
    };
    root.style.setProperty('--border-radius-button', radiusMap[settings.borderRadius]);

    // ボタンパディング（手袋用極大サイズ）
    const paddingMap = {
      normal: '8px 16px',
      large: '16px 32px',
    };
    root.style.setProperty('--button-padding', paddingMap[settings.buttonPadding]);

  }, [settings]);
};
```

### ③ Tailwind CSS変数定義 (`app/globals.css` の一部)
Tailwind CSSの設定とCSS変数のマッピングを行い、アクセシビリティとして**フォーカスリング**の規定を入れます。

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    background-color: #fafafa;
    color: #1a1a1a;
    font-family: var(--font-family-base);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-base);
    line-height: var(--line-height-base);
    transition: font-size 0.2s ease, font-weight 0.2s ease;
  }

  /* アクセシビリティ：キーボード操作用の強コントラスト・フォーカスリング */
  input:focus-visible, 
  select:focus-visible, 
  button:focus-visible,
  [role="button"]:focus-visible {
    outline: 3px solid #3b82f6;
    outline-offset: 2px;
  }
}

@layer components {
  /* 設定値が動的に反映されるボタンコンポーネントクラス */
  .btn-farm {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    padding: var(--button-padding);
    border-radius: var(--border-radius-button);
    background-color: var(--color-primary);
    color: white;
    transition: all 0.2s ease;
  }
  .btn-farm:hover {
    filter: brightness(0.9);
  }
  .btn-farm:active {
    transform: scale(0.98);
  }
}
```

### ④ 日付・数値・文体の汎用フォーマッター (`lib/utils/formatHelper.ts`)
テーマではなく、アプリ内のデータ整形としるべぇのAI会話文体にリアルタイム適用させるためのヘルパーです。

```typescript
import { ThemeSettings } from '@/store/useThemeStore';

/**
 * ユーザー指定の日付フォーマットに変換
 */
export const formatDate = (date: Date | string, format: ThemeSettings['dateFormat']): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  
  if (format === 'slash') {
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`;
};

/**
 * ユーザー指定の数値（重さ、通貨など）の表記フォーマットに変換
 */
export const formatNumber = (
  num: number, 
  format: ThemeSettings['numberFormat'], 
  unit: 'g' | '円' | '個' = 'g'
): string => {
  if (format === 'raw') return String(num);
  const formatted = num.toLocaleString();
  if (format === 'unit') return `${formatted}${unit}`;
  return formatted;
};

/**
 * AIしるべぇの口調（敬体/常体）の動的置換
 * 例：常体「〜だべぇ！」 ➔ 敬体「〜ですよ！」
 */
export const formatShirubeSpeech = (text: string, style: ThemeSettings['politeStyle']): string => {
  if (style === 'polite') {
    return text
      .replace(/だべぇ[！!]/g, 'ですよ！')
      .replace(/するべぇ[！!]/g, 'しましょう！')
      .replace(/だべ[。.]/g, 'ですね。')
      .replace(/だべぇ/g, 'ですね')
      .replace(/だべ？/g, 'ですか？')
      .replace(/だべ/g, 'ですね')
      .replace(/〜だべ/g, '〜ですね');
  }
  return text; // しるべぇのネイティブな常体口調
};
```

### ⑤ 新規設定画面 UI (`app/settings/page.tsx` - Next.js + shadcn/ui + Tailwind)
MUIのSelectやSwitchなどの部品を、Tailwindとshadcn/ui（Radix UI）仕様に完璧に移植した最新の設定画面コードです。

```tsx
'use client';

import React from 'react';
import { useThemeStore } from '@/store/useThemeStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useThemeStore();

  return (
    <div className="container max-w-3xl py-8 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">表示・テーマ設定</h1>
        <p className="text-muted-foreground mt-2">
          泥だらけの手袋をしていたり、日差しが強い屋外の畑で作業していても、サクサク使いやすいように調整できます。
        </p>
      </div>

      {/* 1. 基本設定（カラー・サイズ） */}
      <Card>
        <CardHeader>
          <CardTitle>テーマ・カラー & サイズ</CardTitle>
          <CardDescription>アプリのメイン色と、視認性を決める最も重要な設定項目です。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="primary-color" className="font-semibold">農園のシンボルカラー（メイン）</Label>
              <div className="flex gap-3">
                <input
                  type="color"
                  id="primary-color"
                  value={settings.primaryColor}
                  onChange={(e) => updateSettings({ primaryColor: e.target.value })}
                  className="w-12 h-10 rounded border cursor-pointer ring-offset-background focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                <span className="self-center font-mono text-sm">{settings.primaryColor}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary-color" className="font-semibold">アクセントカラー（通知・警告）</Label>
              <div className="flex gap-3">
                <input
                  type="color"
                  id="secondary-color"
                  value={settings.secondaryColor}
                  onChange={(e) => updateSettings({ secondaryColor: e.target.value })}
                  className="w-12 h-10 rounded border cursor-pointer ring-offset-background focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                <span className="self-center font-mono text-sm">{settings.secondaryColor}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="font-semibold">文字の大きさ（屋外ズーム機能）</Label>
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                {settings.fontSize === 'small' && '小 (14px)'}
                {settings.fontSize === 'medium' && '標準 (16px)'}
                {settings.fontSize === 'large' && '大 (20px)'}
                {settings.fontSize === 'xlarge' && '極大 (24px) ⚠️シニア農家推奨'}
              </span>
            </div>
            <div className="px-2 py-2">
              <Slider
                value={[
                  settings.fontSize === 'small' ? 0 : settings.fontSize === 'medium' ? 1 : settings.fontSize === 'large' ? 2 : 3
                ]}
                max={3}
                step={1}
                onValueChange={(value) => {
                  const sizes: ('small' | 'medium' | 'large' | 'xlarge')[] = ['small', 'medium', 'large', 'xlarge'];
                  updateSettings({ fontSize: sizes[value[0]] });
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. 表示形式（新規追加項目） */}
      <Card>
        <CardHeader>
          <CardTitle>屋外作業・アクセシビリティ</CardTitle>
          <CardDescription>日差し反射の軽減、手袋対応、日付・数字の表記としるべぇの言葉遣いを調整します。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* フォント */}
            <div className="space-y-2">
              <Label className="font-semibold">表示フォント</Label>
              <Select
                value={settings.fontFamily}
                onValueChange={(value: any) => updateSettings({ fontFamily: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sans">標準（ゴシック）</SelectItem>
                  <SelectItem value="serif">クラシック（明朝体）</SelectItem>
                  <SelectItem value="rounded">丸ゴシック（丸くて太い・一番読みやすい）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 文字の太さ */}
            <div className="space-y-2">
              <Label className="font-semibold">文字の太さ（日差し反射対策）</Label>
              <Select
                value={settings.fontWeight}
                onValueChange={(value: any) => updateSettings({ fontWeight: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">標準（細め）</SelectItem>
                  <SelectItem value="medium">中（読みやすい）</SelectItem>
                  <SelectItem value="bold">極太（クッキリ輪郭を浮き立たせる）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 行間 */}
            <div className="space-y-2">
              <Label className="font-semibold">文章の行間（隙間）</Label>
              <Select
                value={settings.lineHeight}
                onValueChange={(value: any) => updateSettings({ lineHeight: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">標準（ぎっしり）</SelectItem>
                  <SelectItem value="relaxed">ゆったり（読みやすい）</SelectItem>
                  <SelectItem value="loose">広い（シニア向け誤読防止）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ボタン形状 */}
            <div className="space-y-2">
              <Label className="font-semibold">ボタンの形</Label>
              <Select
                value={settings.borderRadius}
                onValueChange={(value: any) => updateSettings({ borderRadius: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">四角形</SelectItem>
                  <SelectItem value="md">少し丸い（角丸）</SelectItem>
                  <SelectItem value="full">楕円（丸みがあって見つけやすい）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ボタンパディング（手袋サイズ） */}
            <div className="space-y-2">
              <Label className="font-semibold">ボタンの押しやすさ（手袋対応）</Label>
              <Select
                value={settings.buttonPadding}
                onValueChange={(value: any) => updateSettings({ buttonPadding: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">通常（スマート）</SelectItem>
                  <SelectItem value="large">極大（泥だらけの手袋でも誤タップ防止）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 日付形式 */}
            <div className="space-y-2">
              <Label className="font-semibold">日付の書き方</Label>
              <RadioGroup
                value={settings.dateFormat}
                onValueChange={(value: any) => updateSettings({ dateFormat: value })}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="slash" id="df-slash" />
                  <Label htmlFor="df-slash" className="cursor-pointer">2026/08/11</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="japanese" id="df-jap" />
                  <Label htmlFor="df-jap" className="cursor-pointer">8月11日(火)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* 数値表記 */}
            <div className="space-y-2">
              <Label className="font-semibold">収穫量・単位の表記</Label>
              <Select
                value={settings.numberFormat}
                onValueChange={(value: any) => updateSettings({ numberFormat: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw">そのまま (1500)</SelectItem>
                  <SelectItem value="comma">区切りマークあり (1,500)</SelectItem>
                  <SelectItem value="unit">単位つき (1,500g)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* AIしるべぇ口調変換 */}
            <div className="space-y-2 col-span-1 sm:col-span-2 bg-slate-50 p-4 rounded border">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="font-bold text-base">しるべぇの言葉遣い</Label>
                  <p className="text-sm text-muted-foreground">
                    「〜だべぇ！」を解除し、標準的な「です/ます」に切り替えます。
                  </p>
                </div>
                <Switch
                  checked={settings.politeStyle === 'shirube'}
                  onCheckedChange={(checked) =>
                    updateSettings({ politeStyle: checked ? 'shirube' : 'polite' })
                  }
                />
              </div>
            </div>

          </div>

          <Separator />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={resetSettings}>
              初期設定に戻す
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 💻 3. 各画面へのリアルタイム反映・適用例

### ① グローバルレイアウトでの適用 (`app/layout.tsx`)
フックを一番外側のレイアウトに設置することで、画面遷移をしてもチラつくことなくグローバルにテーマ変更が即時反映されます。

```tsx
'use client';

import { useDynamicTheme } from '@/hooks/useDynamicTheme';
import { useThemeStore } from '@/store/useThemeStore';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 動的テーマ更新の監視ループを開始
  useDynamicTheme();

  return (
    <html lang="ja">
      <body>
        <div className="min-h-screen bg-slate-50 transition-colors">
          {children}
        </div>
      </body>
    </html>
  );
}
```

### ② Teacher Dashboard (`/teacher/dashboard`) での適用例
農園主が登録した生徒一覧や、収穫データ、そして最新のお知らせを綺麗にフォーマットして表示します。

```tsx
'use client';

import React from 'react';
import { useThemeStore } from '@/store/useThemeStore';
import { formatDate, formatNumber } from '@/lib/utils/formatHelper';

export default function TeacherDashboard() {
  const { settings } = useThemeStore();
  
  // ダミーデータ
  const lastUpdated = '2026-08-11T09:00:00Z';
  const cabbageHarvest = 1500; // g
  
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">農園主ダッシュボード</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 日付フォーマットの適用 */}
        <div className="p-4 bg-white rounded shadow">
          <h2 className="text-sm text-muted-foreground">最終同期</h2>
          <p className="text-lg font-bold">{formatDate(lastUpdated, settings.dateFormat)}</p>
        </div>
        
        {/* 数値表記の適用 */}
        <div className="p-4 bg-white rounded shadow">
          <h2 className="text-sm text-muted-foreground">本日のキャベツ総収穫量</h2>
          <p className="text-lg font-bold">{formatNumber(cabbageHarvest, settings.numberFormat, 'g')}</p>
        </div>
      </div>
      
      {/* 動的ボタン */}
      <button className="btn-farm">
        新しいお知らせ（ToDo）を配信
      </button>
    </div>
  );
}
```

### ③ Student Quests (`/student/quests`) ＆ AIしるべぇチャットでの適用例
生徒側のクエスト一覧と、AIしるべぇが「敬体」に自動変換されたアドバイスを返してくれるエリアです。

```tsx
'use client';

import React from 'react';
import { useThemeStore } from '@/store/useThemeStore';
import { formatDate, formatShirubeSpeech } from '@/lib/utils/formatHelper';

export default function StudentQuestsPage() {
  const { settings } = useThemeStore();
  
  const questDeadline = '2026-08-15T18:00:00Z';
  const shirubeRawSpeech = "トマトの葉が白いのはハダニの初期症状だべぇ！この天然資材を薄めて散布するべぇ！";

  return (
    <div className="p-6 space-y-6">
      <div className="border-l-4 border-[var(--color-primary)] pl-4">
        <h1 className="text-2xl font-bold">今週のクエスト</h1>
        <p className="text-sm text-muted-foreground mt-1">
          期限：{formatDate(questDeadline, settings.dateFormat)}
        </p>
      </div>

      {/* しるべぇの吹き出しコンポーネント */}
      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 flex gap-4">
        <div className="w-12 h-12 bg-amber-200 rounded-full flex items-center justify-center text-xl">
          🌾
        </div>
        <div>
          <h3 className="font-bold text-amber-900">しるべぇの助言</h3>
          <p className="mt-1 text-amber-950">
            {formatShirubeSpeech(shirubeRawSpeech, settings.politeStyle)}
          </p>
        </div>
      </div>

      <button className="btn-farm">
        クエスト完了を報告
      </button>
    </div>
  );
}
```

---

## 📈 4. Before / After の改善ポイント一覧

| 評価項目 | 従来の仕様（Before） | 新しいのうあと仕様（After） |
| :--- | :--- | :--- |
| **技術構成** | Next.js ＋ Material-UI (MUI) による動的 `createTheme` 適用。 | **Next.js ＋ Tailwind CSS ＋ shadcn/ui**。CSS Custom Propertiesによる高速かつハイドレーションエラーのない安全な即時反映。 |
| **屋外での視認性** | 文字サイズ調整のみ。日差しでコントラスト比が落ち、画面が白飛びする。 | **文字の太さ (fontWeight) 変更** や **丸ゴシック (rounded) 導入** により、日差しの中でも文字の輪郭がくっきり浮き立つ。 |
| **手袋装着時の操作性** | 標準的なボタン幅。手が泥などで汚れており、手袋をしていると誤タップが頻発する。 | **ボタンの角丸 (borderRadius) 調整** ＋ **極大パディング (buttonPadding)** を追加。手袋をしたままでもピンポイントでタップ可能。 |
| **しるべぇの口調** | 「～だべぇ！」に固定されており、丁寧なやり取りを好むシニア層や他産業ユーザーで好みが分かれる。 | **Switchひとつで「常体/敬体」を動的切り替え**。しるべぇの愛らしさを保ちつつ、普通の「です/ます調」に自動翻訳。 |
| **日付・数値の多様性** | システム標準の英語表記、あるいは固定された表記。 | **曜日つき日本語表記 (japanese)** や、農業単位 (g) などの **単位自動結合機能 (numberFormat)** を搭載。 |
| **アクセシビリティ** | 特になし。 | キーボード操作やタブ選択時における **明瞭な高コントラスト・フォーカスリング** の自動付与。 |
