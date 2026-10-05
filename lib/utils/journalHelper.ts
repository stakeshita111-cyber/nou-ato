/**
 * 🌟 ただの記録（質問・SOSではない日常の畝作業・観察記録）判定ヘルパー 🌟
 */
export const isRegularRecord = (content?: string): boolean => {
  if (!content) return false;
  const trimmed = content.trim();
  // 【畝...】で始まる記録
  if (trimmed.startsWith("【畝")) {
    const hasQuestion =
      /[?？]/.test(trimmed) ||
      trimmed.includes("教えて") ||
      trimmed.includes("どうすれば") ||
      trimmed.includes("どうしたら") ||
      trimmed.includes("相談");
    const hasUrgent = ["枯れ", "病", "害虫", "元気がない", "しおれ", "異変", "カビ"].some(
      (k) => trimmed.includes(k)
    );
    // 質問やSOSが含まれていなければ「ただの記録」
    return !hasQuestion && !hasUrgent;
  }
  return false;
};
