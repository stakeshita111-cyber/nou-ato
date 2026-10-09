import { useThemeStore, ThemeSettings } from '@/store/useThemeStore';

/**
 * ユーザー指定の日付フォーマットに変換（format省略時は現在のテーマ設定を適用）
 */
export const formatDate = (
  date: Date | string,
  format?: ThemeSettings['dateFormat']
): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);

  const activeFormat = format || useThemeStore.getState().settings.dateFormat || 'japanese';

  if (activeFormat === 'slash') {
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`;
};

/**
 * ユーザー指定の数値（重さ、通貨など）の表記フォーマットに変換（format省略時は現在のテーマ設定を適用）
 */
export const formatNumber = (
  num: number,
  format?: ThemeSettings['numberFormat'],
  unit: 'g' | '円' | '個' | string = 'g'
): string => {
  const activeFormat = format || useThemeStore.getState().settings.numberFormat || 'unit';

  if (activeFormat === 'raw') return String(num);
  const formatted = num.toLocaleString();
  if (activeFormat === 'unit') return `${formatted}${unit}`;
  return formatted;
};

/**
 * 収穫量文字列（例: "1500g", "1500", "2kg"）をユーザー設定の表記形式に整形
 */
export const formatHarvestAmount = (
  val?: string | number | null,
  format?: ThemeSettings['numberFormat']
): string => {
  if (val === undefined || val === null) return '';
  if (typeof val === 'number') {
    return formatNumber(val, format, 'g');
  }
  const trimmed = String(val).trim();
  if (!trimmed) return '';

  // kg の場合（例: 1.5kg, 2kg）
  const kgMatch = trimmed.match(/^([\d.]+)\s*kg$/i);
  if (kgMatch) {
    const numKg = parseFloat(kgMatch[1]);
    if (!isNaN(numKg)) {
      const grams = Math.round(numKg * 1000);
      return formatNumber(grams, format, 'g');
    }
  }

  // g または数字のみ（例: 1500g, 1500, 1,500）
  const cleanNumStr = trimmed.replace(/[^\d.]/g, '');
  if (cleanNumStr) {
    const num = parseFloat(cleanNumStr);
    if (!isNaN(num)) {
      return formatNumber(num, format, 'g');
    }
  }

  return trimmed;
};

/**
 * 通貨・金額表記をユーザー設定の表記形式に整形
 */
export const formatMoney = (
  num: number,
  format?: ThemeSettings['numberFormat']
): string => {
  const activeFormat = format || useThemeStore.getState().settings.numberFormat || 'unit';
  if (activeFormat === 'raw') return `¥${num}`;
  if (activeFormat === 'unit') return `¥${num.toLocaleString()}円`;
  return `¥${num.toLocaleString()}`;
};

/**
 * 面積表記（例: 10, "10㎡", "10.5m2"）をユーザー設定の表記形式に整形
 */
export const formatArea = (
  val?: string | number | null,
  format?: ThemeSettings['numberFormat']
): string => {
  if (val === undefined || val === null) return '';
  if (typeof val === 'number') {
    return formatNumber(val, format, '㎡');
  }
  const trimmed = String(val).trim();
  if (!trimmed) return '';

  const normalizedStr = trimmed.replace(/m2|㎡|平米|m\^2/gi, '');
  const cleanNumStr = normalizedStr.replace(/[^\d.]/g, '');
  if (cleanNumStr) {
    const num = parseFloat(cleanNumStr);
    if (!isNaN(num)) {
      return formatNumber(num, format, '㎡');
    }
  }

  return trimmed;
};

/**
 * 講師・アドバイスメッセージのフォーマット補助
 */
export const formatShirubeSpeech = (text: string): string => {
  return text;
};
