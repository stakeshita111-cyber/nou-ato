import { supabase } from '@/lib/supabase';

export interface ReferencedQA {
  id?: string;
  question: string;
  answer: string;
  similarityScore?: number;
}

// 主な作物品種リスト (作物不一致の誤ヒットを防止)
export const CROPS_LIST = [
  'トマト',
  'ミニトマト',
  'きゅうり',
  'キュウリ',
  '胡瓜',
  'ナス',
  'なす',
  '茄子',
  'ピーマン',
  'パプリカ',
  'ジャガイモ',
  'じゃがいも',
  '馬鈴薯',
  'サツマイモ',
  'さつまいも',
  '枝豆',
  'えだまめ',
  'エダマメ',
  'インゲン',
  'いんげん',
  'オクラ',
  'おくら',
  'キャベツ',
  'レタス',
  '白菜',
  'ハクサイ',
  'ほうれん草',
  '小松菜',
  '大根',
  'ダイコン',
  '人参',
  'ニンジン',
  'カブ',
  'イチゴ',
  'いちご',
  'スイカ',
  'ネギ',
  'ねぎ',
  'カボチャ',
  'かぼちゃ',
  '南瓜',
];

// 一般的すぎてマッチングに使ってはいけない動詞・副詞・助詞
export const STOP_WORDS = [
  'の',
  'に',
  'は',
  'を',
  'た',
  'が',
  'で',
  'て',
  'と',
  'し',
  'れ',
  'さ',
  'ある',
  'いる',
  'も',
  'する',
  'から',
  'な',
  'こと',
  'として',
  'について',
  '教えて',
  'ください',
  'どうすれば',
  'いいですか',
  '方法',
  'どう',
  'たくさん',
  'いっぱい',
  '育てる',
  '育て方',
  '栽培',
  '収穫',
  '収穫した',
  '採れた',
  'とれた',
  'コツ',
  'ポイント',
  '時期',
  'タイミング',
  'おすすめ',
  'やり方',
  '仕方',
  '大きく',
  '美味しく',
  '相談',
  '質問',
  'おねがい',
  'お願い',
];

/**
 * DBから受講生の表示名（display_name）リストを動的取得
 */
export async function fetchStudentDisplayNames(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('display_name')
      .not('display_name', 'is', null)
      .neq('display_name', '');

    if (error || !data) return [];
    return data
      .map((u) => u.display_name?.trim())
      .filter((name): name is string => Boolean(name && name.length >= 2));
  } catch (e) {
    console.error('fetchStudentDisplayNames error:', e);
    return [];
  }
}

/**
 * 過去ナレッジから全般的なPII（氏名・電話番号・メール・住所・SNS・家族情報等）を包括的に検知・安全な表現に変換
 * （ハードコードされた特定の個人名を排除し、パターンマッチングおよび受講生リストに基づいて置換）
 */
export function sanitizePiiText(text: string, studentNames: string | string[] = []): string {
  if (!text) return '';
  let clean = text;

  // 0. 動的に取得された受講生表示名リスト（display_name）に基づく汎用置換
  const namesArray = typeof studentNames === 'string' ? [studentNames] : studentNames;
  if (namesArray && namesArray.length > 0) {
    const sortedNames = Array.from(
      new Set(
        namesArray.map((n) => (n || '').trim()).filter((n) => n.length >= 2 && n !== '受講生')
      )
    ).sort((a, b) => b.length - a.length);

    for (const name of sortedNames) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const namePattern = new RegExp(`${escapedName}(?:さん|様|くん|ちゃん|氏)?`, 'g');
      clean = clean.replace(namePattern, '[受講生]');
    }
  }

  // 1. 文頭の「〇〇さん、こんにちは！😊」等の個人向け挨拶ブロックを除去
  clean = clean.replace(
    /^[^\n\r]{1,30}さん[、,!\s]*(?:こんにちは|メッセージありがとうございます|おはようございます|お疲れ様です)[^\n\r]*[\n\r]*/gm,
    ''
  );

  // 2. 「チケット無事に復活しましたね✨」などの個人対話文脈行を除去
  clean = clean.replace(/^[^\n\r]*(?:チケット無事|復活しました)[^\n\r]*[\n\r]*/gm, '');

  // 3. 電話番号 (例: 090-xxxx-xxxx, 03-xxxx-xxxx, 09012345678)
  clean = clean.replace(
    /(?:0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4})|(?:0[789]0[-\s]?\d{4}[-\s]?\d{4})/g,
    '[個人情報]'
  );

  // 4. メールアドレス (例: xxxx@example.com)
  clean = clean.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[個人情報]');

  // 5. 郵便番号・住所・地名
  clean = clean.replace(/〒?\s*\d{3}-\d{4}/g, '[個人情報]');
  clean = clean.replace(
    /(?:東京都|北海道|(?:京都|大阪)府|.{2,3}県)[^\s\n\r,。!！]{2,20}(?:市|区|町|村|丁目|番地|号)[^\s\n\r,。!！]*/g,
    '[個人情報]'
  );

  // 6. LINE ID・SNSアカウント
  clean = clean.replace(
    /(?:LINE\s*ID|ライン\s*ID|Instagram|Twitter|X|インスタ|ツイッター)[:：\s]*@?[a-zA-Z0-9._-]+/gi,
    '[個人情報]'
  );
  clean = clean.replace(/(?:^|\s)@[a-zA-Z0-9_]{3,15}(?=\s|$|[、,。!！])/g, ' [個人情報]');

  // 7. 個人名呼びかけ・氏名単体「受講生の〇〇さん」「〇〇さん、」等の除去/一般化 (名乗り処理の前に実行)
  clean = clean.replace(/受講生の?[^ \n\r!！🌱〜]+(?:さん|様|くん|ちゃん)/g, '受講生の方');
  clean = clean.replace(/[^ \n\r!！🌱〜]{1,10}(?:さん|様|くん|ちゃん|氏)[、,!\s]*/g, '');

  // 8. 氏名・自己紹介名乗り（例: 山田太郎です、〜と申します）
  clean = clean.replace(/(?:[一-龠ぁ-んァ-ヶ]{1,10})と申します/g, '[受講生]と申します');
  clean = clean.replace(
    /(?:私|僕|俺|名前)(?:は|が)?\s*([一-龠ぁ-んァ-ヶ]{2,10})です/g,
    '[受講生]です'
  );
  clean = clean.replace(/(?:[一-龠]{2,4}\s+[一-龠]{1,4}|[一-龠]{2,4}[一-龠]{2})です/g, (match) => {
    if (
      /(?:時期|方法|対策|栽培|管理|作業|状態|目安|結果|様子|予定|確認|報告|相談|質問|感謝|初心者|追肥|病気|害虫|水やり|野菜|農園|収穫|土作り)です$/.test(
        match
      )
    ) {
      return match;
    }
    return '[受講生]です';
  });

  // 9. 家庭・家族情報（例: うちの娘が、息子の〇〇が）
  clean = clean.replace(
    /(?:うちの|私の|僕の|俺の|我が家の)?(?:娘|息子|夫|妻|旦那|奥さん|子供|子ども|祖父|祖母|父|母|お父さん|お母さん)(?:の[^\s\n\r,。!！]{1,10})?/g,
    '[ご家族]'
  );

  // 10. 文頭の余分な改行・空白の整理
  clean = clean.trim();

  return clean || text.trim();
}

/**
 * 後方互換性のためのエイリアス
 */
export function sanitizePersonalNames(text: string, dynamicNames: string[] = []): string {
  return sanitizePiiText(text, dynamicNames);
}

/**
 * AI回答または講師回答（reply）からサニタイズされた【相談トピック】を抽出
 * 回答内に【相談トピック: 〇〇】等があればそれを抽出し、なければ本文の冒頭見出しまたは一般化見出しを返す
 */
export function extractTopicFromReply(reply: string): string {
  if (!reply) return '【相談トピック: 野菜の栽培・管理について】';

  // 1. 【相談トピック: ...】または【相談概要: ...】のパターンを抽出
  const topicMatch = reply.match(/【(?:相談トピック|相談概要|トピック|概要)[：:]\s*([^】\n\r]+)】/);
  if (topicMatch && topicMatch[1]) {
    return `【相談トピック: ${topicMatch[1].trim()}】`;
  }

  // 2. 【農園アドバイス: ...】などのパターンがある場合
  const adviceMatch = reply.match(/【(?:農園アドバイス|アドバイス)[：:]\s*([^】\n\r]+)】/);
  if (adviceMatch && adviceMatch[1]) {
    const cleanAdv = adviceMatch[1].replace(/[🌱🍅🐛💧✨🧑‍🌾]/g, '').trim();
    return `【相談トピック: ${cleanAdv}】`;
  }

  // 3. 回答の1行目に【...】で囲まれた見出しがある場合
  const firstLine = reply.split(/[\n\r]+/)[0].trim();
  const headerMatch = firstLine.match(/^【([^】]+)】/);
  if (headerMatch && headerMatch[1]) {
    return `【相談トピック: ${headerMatch[1].trim()}】`;
  }

  // 4. フォールバック
  return '【相談トピック: 野菜の栽培・管理について】';
}

/**
 * ユーザーの質問と過去のナレッジを比較し、関連性の高い順にソートして抽出
 * 🌟 生徒の生相談文(content)の参照を完全廃止し、サニタイズされたreply(回答・トピック)のみから照合 🌟
 * 🌟 非公開相談(is_private = true)はDB層で厳密に除外 🌟
 */
export async function searchSimilarKnowledge(userQuestion: string): Promise<ReferencedQA[]> {
  try {
    const { data: dbData, error } = await supabase
      .from('journals')
      .select('id, reply, is_approved, is_private, student_id')
      .eq('is_approved', true)
      .eq('is_private', false)
      .not('reply', 'is', null)
      .neq('reply', '')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !dbData || dbData.length === 0) {
      return [];
    }

    const pastQa: (ReferencedQA & { id?: string })[] = [];

    // ユーザー質問に含まれる作物を特定
    const queryCrops = CROPS_LIST.filter((crop) => userQuestion.includes(crop));

    // 助詞除去＆重要キーワード抽出 (STOP_WORDSを除外)
    const rawTokens = userQuestion
      .toLowerCase()
      .replace(/[、。！？!?,.\n\r]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0);

    const questionKeywords: string[] = [];
    rawTokens.forEach((token) => {
      let current = token;
      STOP_WORDS.forEach((sw) => {
        if (current === sw) {
          current = '';
        } else if (current.length > sw.length && (current.endsWith(sw) || current.startsWith(sw))) {
          current = current.replace(new RegExp(`^${sw}|${sw}$`, 'g'), '');
        }
      });
      if (current.length >= 2 && !STOP_WORDS.includes(current)) {
        questionKeywords.push(current);
      }
    });

    dbData.forEach((item) => {
      if (!item.reply) return;

      const itemReply = item.reply.toLowerCase();

      // 🌟【重要】作物の厳格チェック: ユーザーが作物を指定している場合、他作物のノウハウは除外 🌟
      if (queryCrops.length > 0) {
        // この回答（および相談トピック）に対象作物が含まれているか？
        const containsTargetCrop = queryCrops.some((crop) =>
          itemReply.includes(crop.toLowerCase())
        );
        if (!containsTargetCrop) {
          return; // 対象作物が含まれていなければスキップ
        }
      }

      let score = 0;

      // 1. 重要キーワードの一致 (生徒の生質問文contentは完全未参照・replyのみから照合)
      questionKeywords.forEach((kw) => {
        if (itemReply.includes(kw)) {
          score += kw.length >= 3 ? 6 : 4;
        }
      });

      // 2. 講師承認済みナレッジ (is_approved = true) の重みづけ 1.2倍
      if (item.is_approved === true) {
        score *= 1.2;
      }

      // スコアが十分に高い（明確な重要語一致がある）ものだけ抽出
      if (score >= 4) {
        const extractedTopic = extractTopicFromReply(item.reply);
        pastQa.push({
          id: (item.id || '').toString(),
          question: extractedTopic,
          answer: sanitizePiiText(item.reply),
          similarityScore: score,
        });
      }
    });

    // 類似スコアが高い順にソートして最大3件抽出
    pastQa.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
    return pastQa.slice(0, 3);
  } catch (e) {
    console.error('searchSimilarKnowledge error:', e);
    return [];
  }
}

/**
 * 過去のQ&Aナレッジをプロンプトに注入し、最適なAI回答を生成 (systemInstruction分離・ヘッダー認証・タイムアウト・自動カスケード)
 */
export async function getAnswerWithRag(
  userQuestion: string,
  studentName: string = '受講生',
  recentHistoryText: string = ''
): Promise<{ reply: string; referencedQa: ReferencedQA[] }> {
  // 🌟「大量質問テスト」トリガーの即時ルールベース返信 🌟
  if (userQuestion.includes('大量質問テスト')) {
    return {
      reply:
        '【AI相棒（しるべぇ）よりお知らせ】🌱\n\n現在、たくさんの受講生のみなさまからご質問・ご相談をいただいており、本日のAI自動対話枠が上限（混雑状態）に達しております🙇\n\nご入力いただいたメッセージは交換日記として大切にお預かりしておりますので、講師からの直接の回答をお待ちいただくか、お時間を空けて再度お試しくださいね✨\n\n美味しい野菜づくりを応援しています🧑‍🌾',
      referencedQa: [],
    };
  }

  // 🌟 DBから受講生表示名リストを取得 & Gemini送信前サニタイズパイプライン 🌟
  const studentDisplayNames = await fetchStudentDisplayNames();
  const allStudentNames = Array.from(
    new Set([...studentDisplayNames, studentName].filter(Boolean))
  );

  const cleanUserQuestion = sanitizePiiText(userQuestion, allStudentNames);
  const cleanRecentHistoryText = sanitizePiiText(recentHistoryText, allStudentNames);

  // 1. 類似ナレッジを検索 (重み1.2倍を優先)
  const referencedQa = await searchSimilarKnowledge(cleanUserQuestion);

  // 2. Gemini API 呼び出し
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return {
      reply: 'メッセージを受け付けました！次回来園時に講師より詳しく回答いたしますね🌱',
      referencedQa,
    };
  }

  try {
    const knowledgeSection =
      referencedQa.length > 0
        ? `【農園DBナレッジ（重要度重み: 1.2倍・最優先参照）】\n` +
          referencedQa
            .map(
              (qa, i) =>
                `[事例${i + 1}] 過去の相談トピック:「${sanitizePiiText(qa.question, allStudentNames)}」➔ 講師の回答:「${sanitizePiiText(qa.answer, allStudentNames)}」 (関連度スコア: ${
                  qa.similarityScore?.toFixed(1) || 1.2
                })`
            )
            .join('\n\n')
        : `【農園DBナレッジ】該当する過去の指導データはありません。一般的な自然栽培・有機栽培の知見と親身な日常会話で対応してください。`;

    const systemInstruction = `あなたは体験農園「NOU-ATO」の優しく親しみやすい講師アドバイザーAI「しるべぇ（講師AI）」です。
体験農園の受講生から相談・メッセージが届きました。

【⚠️ 最重要：プライバシー保護とナレッジ共有の絶対ルール】
1. **回答の冒頭フォーマット (必須):**
   回答の1行目（冒頭）には、生徒の生テキストから個人情報を排除し、相談テーマを一般化した見出しを『【相談トピック: 〇〇について】』という形式で必ず記載してください。
   例: 【相談トピック: トマトの葉の黄変と追肥について】
   その後、改行を入れてから回答本文を開始してください。

2. **個人情報の排除:**
   回答文の中に、生徒の個人名（「〇〇さん」など）や電話番号、住所等の個人情報を絶対に含めないでください。
   この回答は将来、他の受講生が同じ悩みを抱えた際にも共有ナレッジとして参照されるため、名前を呼ばずに「こんにちは！🌱」「ご質問ありがとうございます！」のように温かく親身なトーンで回答してください。

【対話の基本指針】
1. **普段の気軽な日常会話・挨拶:**
   - 挨拶（おはよう、こんにちは、お疲れ様など）や雑談には、明るく親しみやすいトーンで自然に応答してください。
   - 専門的な相談でない場合は無理に長文にせず、温かい会話のキャッチボールを行ってください。

2. **農園DBナレッジの最優先活用（重み 1.2）:**
   - 野菜の育て方、病気、害虫、水やり、追肥、芽かき等の栽培に関する相談の場合、以下の【農園DBナレッジ】に記載された当農園の講師の教えやアドバイス方針を **最優先（重み1.2）** で反映してください。
   - DBナレッジに記載がある内容は、当農園の実績に基づく確かな知見として「当農園では〜」「以前講師からも〜とお伝えしています」といった形で信頼感を込めて伝えてください。
   - DBナレッジにない部分は、一般的な自然栽培・家庭菜園の安心な知識で補足し、「次回の来園時に講師にも直接ご相談くださいね」と添えてください。

3. **トーン＆マナー:**
   - 優しく寄り添う話し方（「〜してみてくださいね🌱」「何かあればいつでも気軽に聞いてくださいね！」）。
   - 読みやすい適度な文章量（200〜450文字程度、箇条書きや絵文字を適度に活用）。文章は途中で途切れず、最後まで丁寧に完結させてください。

${knowledgeSection}`;

    const userPrompt = cleanRecentHistoryText
      ? `【これまでの直近の会話の流れ】\n${cleanRecentHistoryText}\n\n受講生の新しい相談メッセージ: 「${cleanUserQuestion}」`
      : `受講生の新しい相談メッセージ: 「${cleanUserQuestion}」`;

    const preferredModel = process.env.GEMINI_MODEL;
    const modelsToTry = [
      preferredModel,
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
    ].filter(Boolean) as string[];

    const uniqueModels = Array.from(new Set(modelsToTry));

    for (const modelName of uniqueModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': geminiApiKey,
            },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemInstruction }],
              },
              contents: [
                {
                  role: 'user',
                  parts: [{ text: userPrompt }],
                },
              ],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2500,
              },
            }),
          }
        );

        if (response.ok) {
          const resData = (await response.json()) as {
            candidates?: Array<{
              content?: {
                parts?: Array<{ text?: string; thought?: boolean }>;
              };
            }>;
          };
          const parts = resData.candidates?.[0]?.content?.parts || [];
          const generatedText =
            parts
              .filter((p) => !p.thought && p.text)
              .map((p) => p.text)
              .join('\n')
              .trim() || parts[0]?.text?.trim();

          if (generatedText) {
            return { reply: generatedText, referencedQa };
          }
        }
      } catch (apiErr) {
        console.warn(`Gemini API call to ${modelName} failed:`, apiErr);
      }
    }
  } catch (err) {
    console.warn('Gemini cascade failed, falling back to rate limit message:', err);
  }

  return {
    reply:
      '【AI相棒（しるべぇ）よりお知らせ】🌱\n\n現在、たくさんの受講生のみなさまからご質問・ご相談をいただいており、本日のAI自動対話枠が上限（混雑状態）に達しております🙇\n\nご入力いただいたメッセージは交換日記として大切にお預かりしておりますので、講師からの直接の回答をお待ちいただくか、お時間を空けて再度お試しくださいね✨\n\n美味しい野菜づくりを応援しています🧑‍🌾',
    referencedQa,
  };
}

export interface ChatHistoryItem {
  sender: 'student' | 'teacher' | 'system';
  text: string;
}

export async function generateRagAnswer(
  userQuestion: string,
  studentName: string = '受講生',
  history: ChatHistoryItem[] = []
): Promise<{ reply: string; referencedQa: ReferencedQA[] }> {
  const historyText = history
    .map((h) => `${h.sender === 'student' ? '受講生' : 'しるべぇ(AI)'}: ${h.text}`)
    .join('\n');
  return getAnswerWithRag(userQuestion, studentName, historyText);
}
