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
  unit: 'g' | '円' | '個' | string = 'g'
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
