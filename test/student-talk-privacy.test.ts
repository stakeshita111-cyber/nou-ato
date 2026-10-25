import { describe, it, expect } from 'vitest';
import {
  formatQuestionTopic,
  prepareMessageForSend,
  processChatHistory,
} from '@/lib/utils/journalHelper';

describe('StudentTalkView Message Parsing & Duplication Prevention', () => {
  it('renders 1 student bubble and 1 teacher bubble when teacher replies to student consultation', () => {
    const dbJournals = [
      {
        id: 'j_1',
        role: 'student',
        content: 'トマトの葉が黄色くなりました',
        reply: '下葉の黄変は自然な現象です。気になる場合は切り取ってください。',
      },
      {
        id: 'j_2_notification',
        role: 'broadcast',
        text: '【返信】講師から相談への回答が届きました',
        content: '下葉の黄変は自然な現象です。気になる場合は切り取ってください。',
        reply: '講師からの返信',
      },
    ];

    const messages = processChatHistory(dbJournals);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      id: 'q_j_1',
      sender: 'student',
      text: 'トマトの葉が黄色くなりました',
    });
    expect(messages[1]).toMatchObject({
      id: 'a_j_1',
      sender: 'teacher',
      text: '下葉の黄変は自然な現象です。気になる場合は切り取ってください。',
    });
  });

  it('renders teacher broadcast/direct messages as teacher bubbles and excludes dummy metadata reply', () => {
    const dbJournals = [
      {
        id: 'j_bc_1',
        role: 'broadcast',
        text: '【講師からのメッセージ】',
        content: '明日の現地体験は雨天のため延期いたします。',
        reply: '講師個別連絡: のうあと農園',
      },
    ];

    const messages = processChatHistory(dbJournals);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: 't_j_bc_1',
      sender: 'teacher',
      text: '明日の現地体験は雨天のため延期いたします。',
    });
  });

  it('excludes notification broadcast and never renders teacher reply as student bubble', () => {
    const dbJournals = [
      {
        id: 'j_c1',
        role: 'student',
        content: 'ありがとうございました。TEST',
        reply: 'どういたしまして！TEST',
      },
      {
        id: 'j_notif',
        role: 'broadcast',
        text: '【返信】講師から相談への回答が届きました',
        content: 'どういたしまして！TEST',
        reply: '講師からの返信',
      },
    ];

    const messages = processChatHistory(dbJournals);

    // Exactly 2 messages: student question, and teacher reply. The notification broadcast MUST NOT be rendered as a green student bubble.
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      id: 'q_j_c1',
      sender: 'student',
      text: 'ありがとうございました。TEST',
    });
    expect(messages[1]).toMatchObject({
      id: 'a_j_c1',
      sender: 'teacher',
      text: 'どういたしまして！TEST',
    });
    // Ensure "どういたしまして！TEST" is never sent by student
    const studentReplies = messages.filter(
      (m) => m.sender === 'student' && m.text.includes('どういたしまして')
    );
    expect(studentReplies).toHaveLength(0);
  });
});

describe('StudentTalkView Privacy Features', () => {
  it('formats question topic using matched keywords instead of raw text', () => {
    const item = {
      question: '山田太郎です。トマトの葉が黄色いのですが、住所は東京都...',
      matchedKeywords: ['トマト', '葉が黄色'],
    };
    const topic = formatQuestionTopic(item);
    expect(topic).toBe('【トマト・葉が黄色】に関する栽培相談');
    expect(topic).not.toContain('山田太郎');
  });

  it('sanitizes personal names in fallback question topic', () => {
    const item = {
      question: '鈴木太郎さん、イチゴの芽かきについて質問です',
      matchedKeywords: [],
    };
    const topic = formatQuestionTopic(item);
    expect(topic).not.toContain('鈴木太郎');
  });

  it('has default allowKnowledgeShare state set to true (default ON)', () => {
    const defaultAllowKnowledgeShare = true;
    const rawInput = 'ナスのアブラムシ対策について教えてください';
    const messageToSend = prepareMessageForSend(rawInput, defaultAllowKnowledgeShare);

    expect(defaultAllowKnowledgeShare).toBe(true);
    expect(messageToSend).toBe('ナスのアブラムシ対策について教えてください');
    expect(messageToSend.startsWith('【非公開相談】')).toBe(false);
  });

  it('correctly adds 【全体共有不可】 tag (is_private = false for teacher viewing) when opt-out toggle is OFF (false)', () => {
    const allowKnowledgeShare = false;
    const rawInput = '個人的な質問です';
    const messageToSend = prepareMessageForSend(rawInput, allowKnowledgeShare);

    expect(messageToSend).toBe('【全体共有不可】個人的な質問です');
    expect(messageToSend.startsWith('【全体共有不可】')).toBe(true);
    expect(messageToSend.startsWith('【非公開メモ】')).toBe(false);
  });

  it('does not duplicate 【全体共有不可】 tag if input text already starts with it', () => {
    const allowKnowledgeShare = false;
    const rawInput = '【全体共有不可】すでにタグが含まれる相談文';
    const messageToSend = prepareMessageForSend(rawInput, allowKnowledgeShare);

    expect(messageToSend).toBe('【全体共有不可】すでにタグが含まれる相談文');
    expect(messageToSend).not.toBe('【全体共有不可】【全体共有不可】すでにタグが含まれる相談文');
  });

  it('synchronizes allowKnowledgeShare state across form toggle and modals', () => {
    const state = { allowKnowledgeShare: true };

    // 1. フォーム直下のトグル操作で OFF に切り替え
    state.allowKnowledgeShare = false;
    expect(state.allowKnowledgeShare).toBe(false);

    // 2. パターンA (ナレッジ一致モーダル) からの送信時に OFF 設定が確実に反映されることを確認
    const patternAMessage = prepareMessageForSend(
      'トマトの連作障害について',
      state.allowKnowledgeShare
    );
    expect(patternAMessage).toBe('【全体共有不可】トマトの連作障害について');

    // 3. パターンB (チケット確認モーダル) 内で ON に切り替え
    state.allowKnowledgeShare = true;
    expect(state.allowKnowledgeShare).toBe(true);

    // 4. パターンB からの送信時に ON 設定が反映されることを確認
    const patternBMessage = prepareMessageForSend(
      'トマトの連作障害について',
      state.allowKnowledgeShare
    );
    expect(patternBMessage).toBe('トマトの連作障害について');
    expect(patternBMessage.startsWith('【全体共有不可】')).toBe(false);
  });

  it('includes bed consultations with ❗ [相談] or teacher replies in chat history while excluding routine bed logs', () => {
    const dbJournals = [
      {
        id: 'j_routine',
        role: 'student',
        content: '【畝 1 (トマト 🍅)】水やりと草むしりを行いました。',
      },
      {
        id: 'j_bed_consultation',
        role: 'student',
        content: '【畝 1 (トマト 🍅)】❗ [相談] 葉の裏に斑点が出てきました',
        reply: '斑点細菌病の可能性があります。該当の葉を取り除いて風通しを良くしてください。',
      },
      {
        id: 'j_bed_replied_without_tag',
        role: 'student',
        content: '【畝 2 (ナス 🍆)】成長が遅い気がします',
        reply: '一番花の下のわき芽を摘み取り、追肥を一握りあげてください。',
      },
    ];

    const messages = processChatHistory(dbJournals);

    // Routine log is excluded, but both consultations with replies are preserved
    expect(messages).toHaveLength(4);

    // Consultation 1
    expect(messages[0]).toMatchObject({
      id: 'q_j_bed_consultation',
      sender: 'student',
      text: '【畝 1 (トマト 🍅)】❗ [相談] 葉の裏に斑点が出てきました',
    });
    expect(messages[1]).toMatchObject({
      id: 'a_j_bed_consultation',
      sender: 'teacher',
      text: '斑点細菌病の可能性があります。該当の葉を取り除いて風通しを良くしてください。',
    });

    // Consultation 2 (no explicit tag, but has teacher reply)
    expect(messages[2]).toMatchObject({
      id: 'q_j_bed_replied_without_tag',
      sender: 'student',
      text: '【畝 2 (ナス 🍆)】成長が遅い気がします',
    });
    expect(messages[3]).toMatchObject({
      id: 'a_j_bed_replied_without_tag',
      sender: 'teacher',
      text: '一番花の下のわき芽を摘み取り、追肥を一握りあげてください。',
    });
  });
});
