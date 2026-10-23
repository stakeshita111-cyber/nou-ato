/**
 * Supabase Auth の signUp エラーを、ユーザー向けの文言に変換するための判定。
 *
 * 確認メールの送信回数上限 (over_email_send_rate_limit / "email rate limit exceeded") は
 * メッセージに "email" を含むため、メールアドレス形式エラーと取り違えないよう先に判定する。
 */

export const EMAIL_RATE_LIMIT_MESSAGE =
  '確認メールの送信回数の上限に達しました。しばらく時間をおいてからお試しください。';

type AuthErrorLike = { message: string; code?: string };

export function isEmailRateLimitError(error: AuthErrorLike): boolean {
  if (error.code === 'over_email_send_rate_limit') return true;
  return /email rate limit/i.test(error.message);
}
