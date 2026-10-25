import { sanitizePersonalNames } from '@/lib/rag/qaKnowledgeRetriever';

/**
 * 🌟 ただの記録（質問・SOSではない日常の畝作業・観察記録）判定ヘルパー 🌟
 */
export const isRegularRecord = (content?: string): boolean => {
  if (!content) return false;
  const trimmed = content.trim();
  // 【畝...】または【区画...】で始まる記録
  if (trimmed.startsWith('【畝') || trimmed.startsWith('【区画')) {
    const hasQuestion =
      /[?？]/.test(trimmed) ||
      trimmed.includes('教えて') ||
      trimmed.includes('どうすれば') ||
      trimmed.includes('どうしたら') ||
      trimmed.includes('相談') ||
      trimmed.includes('❗ [相談]') ||
      trimmed.includes('❗[相談]');
    const hasUrgent = ['枯れ', '病', '害虫', '元気がない', 'しおれ', '異変', 'カビ'].some((k) =>
      trimmed.includes(k)
    );
    // 質問やSOSが含まれていなければ「ただの記録」
    return !hasQuestion && !hasUrgent;
  }
  return false;
};

/**
 * 🌟 畑画面（区画・畝）からの日誌・相談判定ヘルパー 🌟
 */
export const isFarmJournal = (content?: string): boolean => {
  if (!content) return false;
  const trimmed = content.trim();
  return (
    trimmed.startsWith('【畝') ||
    trimmed.startsWith('【区画') ||
    trimmed.includes('❗ [相談]') ||
    trimmed.includes('❗[相談]')
  );
};

/**
 * 送信前メッセージのフォーマットヘルパー（全体共有不可・非公開メモタグの制御）
 */
export const prepareMessageForSend = (rawInput: string, allowKnowledgeShare: boolean): string => {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  // 明示的な個人メモ（講師非公開）タグが既にある場合
  if (trimmed.startsWith('【非公開メモ】') || trimmed.startsWith('【個人メモ】')) {
    return trimmed;
  }

  // 共有許可(allowKnowledgeShare)が ON の場合
  if (allowKnowledgeShare) {
    return trimmed.replace(/^【(?:非公開相談|全体共有不可)】/, '');
  }

  // 共有許可が OFF (オプトアウト) の場合: 講師への相談(is_private = false)としつつ全体共有不可タグを付与
  if (trimmed.startsWith('【全体共有不可】')) {
    return trimmed;
  }
  if (trimmed.startsWith('【非公開相談】')) {
    return trimmed.replace(/^【非公開相談】/, '【全体共有不可】');
  }
  return `【全体共有不可】${trimmed}`;
};

export interface MatchedKnowledgeTopicItem {
  question: string;
  matchedKeywords?: string[];
}

/**
 * 質問トピック整形ヘルパー（個人情報サニタイズ・キーワード優先表示）
 */
export const formatQuestionTopic = (item: MatchedKnowledgeTopicItem): string => {
  if (item.matchedKeywords && item.matchedKeywords.length > 0) {
    return `【${item.matchedKeywords.join('・')}】に関する栽培相談`;
  }
  const cleanQ = sanitizePersonalNames(item.question);
  if (cleanQ) {
    return cleanQ.length > 35 ? cleanQ.slice(0, 35) + '...' : cleanQ;
  }
  return '【農園トピック】に関する栽培相談';
};

export interface ChatJournalSourceItem {
  id?: string;
  role?: string;
  content?: string;
  text?: string;
  reply?: string;
  created_at?: string;
  date?: string;
  student_id?: string;
  task_title?: string;
}

export interface ChatMessageItem {
  id: string;
  sender: 'student' | 'teacher';
  text: string;
  timestamp: string;
  referencedQa?: { question: string; answer: string }[];
  isPending?: boolean;
  stockItems?: string[];
  isKnowledgeHit?: boolean;
}

/**
 * 🌟 生徒チャット対話履歴の整形・重複排除ヘルパー 🌟
 * - 講師返信時に自動生成される通知用重複行（role='broadcast', text='【返信】...', reply='講師からの返信'）を物理排除
 * - 講師配信（role='teacher' / 'broadcast'）は確実に左側（teacher吹き出し）にマッピング
 * - 生徒の相談レコードは相談内容を右側（student吹き出し）、講師の返信を左側（teacher吹き出し）に正しく分離
 */
export function processChatHistory(targetList: ChatJournalSourceItem[]): ChatMessageItem[] {
  const formatted: ChatMessageItem[] = [];

  (targetList || []).forEach((j) => {
    const c = String(j.content || '').trim();

    // 🌟 畝起点の相談（❗ [相談]）または講師返信（reply）があるものはチャット履歴として救出 🌟
    const isConsultationOrHasReply =
      c.includes('❗ [相談]') ||
      c.includes('[相談]') ||
      (Boolean(j.reply) &&
        j.reply !== '講師からの返信' &&
        !String(j.reply).startsWith('講師配信') &&
        !String(j.reply).startsWith('講師個別連絡'));

    // 単なる畝の日常作業・観察記録（返信も相談フラグもないもの）は相談タブから除外
    const isRoutineBedLog =
      (c.startsWith('【畝') || c.includes('【畝 ') || c.includes('【畝')) &&
      !isConsultationOrHasReply;

    if (
      !c ||
      c === 'テスト' ||
      c === '○○困ってます' ||
      isRoutineBedLog ||
      c.startsWith('【収穫') ||
      c.includes('【収穫完了報告】') ||
      c.startsWith('【差し戻し') ||
      c.startsWith('【承認') ||
      c.startsWith('【全体お知らせ') ||
      c.includes('を完了報告しました') ||
      c.includes('タスク完了') ||
      (j.task_title && !j.reply && (c.startsWith('【') || c.includes('完了')))
    ) {
      return;
    }

    // 🌟 講師返信時に自動作成される通知用重複レコード（例: role="broadcast", text="【返信】...", reply="講師からの返信"）は除外 🌟
    // （返信本文は元の相談レコード j.reply に保持されており、そちらから講師吹き出しとしてレンダリングされるため）
    if (
      j.reply === '講師からの返信' ||
      j.text === '【返信】講師から相談への回答が届きました' ||
      String(j.text || '').startsWith('【返信】')
    ) {
      return;
    }

    const isTeacherRole =
      j.role === 'broadcast' || j.role === 'teacher' || j.role === 'announcement';

    const formattedTimestamp = j.created_at
      ? new Date(j.created_at).toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : j.date || '過去のメッセージ';

    if (isTeacherRole) {
      // 講師起点の配信・メッセージ（j.content が講師メッセージ本文）
      if (j.content) {
        formatted.push({
          id: 't_' + (j.id || Date.now().toString()),
          sender: 'teacher',
          text: j.content,
          timestamp: formattedTimestamp,
        });
      }
    } else {
      // 生徒起点の相談・質問日誌
      if (j.content) {
        formatted.push({
          id: 'q_' + (j.id || Date.now().toString()),
          sender: 'student',
          text: j.content,
          timestamp: formattedTimestamp,
        });
      }
      if (
        j.reply &&
        j.reply !== '講師からの返信' &&
        !j.reply.startsWith('講師配信') &&
        !j.reply.startsWith('講師個別連絡')
      ) {
        formatted.push({
          id: 'a_' + (j.id || Date.now().toString()),
          sender: 'teacher',
          text: j.reply,
          timestamp: j.created_at
            ? new Date(j.created_at).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : j.date || '回答済み',
        });
      }
    }
  });

  return formatted;
}

export interface SlideItemRecord {
  itemType?: 'record';
  id: string;
  studentName: string;
  studentAvatar?: string;
  title: string;
  content: string;
  imageUrl?: string;
  harvestAmount?: string;
  dateStr: string;
  timeStr: string;
  timestamp: number;
  plotCode?: string;
  farmId?: string;
}

/**
 * 🌟 生徒作業・観察記録のスライド統合＆重複排除ヘルパー 🌟
 * - 同一生徒による同一内容（同一画像、または「作業を完了しました」等の同日同一コメント）を統合
 */
export function mergeSlideRecords(allRecords: SlideItemRecord[]): SlideItemRecord[] {
  allRecords.sort((a, b) => b.timestamp - a.timestamp);

  const mergedRecordsMap = new Map<string, SlideItemRecord>();

  allRecords.forEach((r) => {
    const normalizedContent = (r.content || '').trim().replace(/\s+/g, ' ');
    const isDefaultCompletionText =
      !normalizedContent ||
      normalizedContent === '作業を完了しました。' ||
      normalizedContent === '作業を完了しました' ||
      normalizedContent === '（コメントなし）';

    let groupKey = '';
    if (r.imageUrl && r.imageUrl.trim() && r.imageUrl.startsWith('http')) {
      groupKey = `img_${r.studentName}_${r.imageUrl.trim()}`;
    } else if (isDefaultCompletionText) {
      groupKey = `default_${r.studentName}_${r.dateStr}`;
    } else if (normalizedContent.length > 0 && normalizedContent.length <= 60) {
      groupKey = `content_${r.studentName}_${r.dateStr}_${normalizedContent}`;
    } else {
      groupKey = `id_${r.id || `${r.studentName}_${r.dateStr}_${r.timeStr}_${r.title}`}`;
    }

    if (!mergedRecordsMap.has(groupKey)) {
      mergedRecordsMap.set(groupKey, { ...r });
    } else {
      const existing = mergedRecordsMap.get(groupKey)!;

      const existingParts = existing.title.split(',').map((t) => t.trim());
      const newParts = r.title.split(',').map((t) => t.trim());
      const mergedTitles = Array.from(new Set([...existingParts, ...newParts])).filter(Boolean);

      if (mergedTitles.length > 2) {
        existing.title = `${mergedTitles[0]} 他${mergedTitles.length - 1}件`;
      } else {
        existing.title = mergedTitles.join(', ');
      }

      if (!existing.imageUrl && r.imageUrl) {
        existing.imageUrl = r.imageUrl;
      }

      if (
        (!existing.content || existing.content === '作業を完了しました。') &&
        r.content &&
        r.content !== '作業を完了しました。'
      ) {
        existing.content = r.content;
      }

      if (!existing.harvestAmount && r.harvestAmount) {
        existing.harvestAmount = r.harvestAmount;
      }
    }
  });

  return Array.from(mergedRecordsMap.values());
}
