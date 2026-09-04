"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Toast from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import {
  getTicketState,
  consumeTicket,
  restoreTicketsBySpell,
  isSecretTicketSpell,
  DEFAULT_DAILY_TICKETS,
  TicketPlanType,
  getQuestionStock,
  addQuestionStock,
  clearQuestionStock,
  formatStockText,
} from "@/lib/ticketManager";

interface MessageItem {
  id: string;
  sender: "student" | "teacher" | "system";
  text: string;
  timestamp: string;
  referencedQa?: { question: string; answer: string }[];
  isPending?: boolean;
  stockItems?: string[];
  isKnowledgeHit?: boolean;
}

interface MatchedKnowledgeItem {
  id: string;
  question: string;
  answer: string;
  matchedKeywords: string[];
}

interface StudentTalkViewProps {
  journals?: any[];
  studentName?: string;
  studentId?: string;
  customDailyLimit?: number;
  planType?: TicketPlanType;
}

// 定型よくある質問（無料・チケット非消費）
const PRESET_FAQS = [
  {
    id: "faq_fertilizer",
    chipLabel: "🌱 追肥のやり方",
    question: "追肥のタイミングやおすすめのやり方を教えてください",
    answer: "【農園アドバイス：追肥の基本】🌱\n\n植え付けから2〜3週間後、または一番果（最初の実）がついた頃が1回目の追肥タイミングです！\n株元から少し離れた場所に肥料を一握り施し、土と軽く混ぜてあげてくださいね。有機ぼかし肥や油かすを使うと根を傷めず元気に育ちます✨",
  },
  {
    id: "faq_yellow_leaf",
    chipLabel: "🍅 葉が黄色い",
    question: "葉っぱが黄色くなってきました。どうすればいいですか？",
    answer: "【農園アドバイス：葉の黄変について】🍅\n\n・一番下の古い葉が黄色い場合：自然な老化ですので、風通しを良くするため根本からハサミで切り取って大丈夫です。\n・株全体や上部が黄色い場合：水切れ、または肥料切れ（チッソ不足）の可能性があります。土の乾き具合を確認し、必要に応じて追肥を行ってみてくださいね！",
  },
  {
    id: "faq_pest",
    chipLabel: "🐛 害虫の対策",
    question: "害虫（ハダニやアブラムシ）を見つけました。無農薬での対策は？",
    answer: "【農園アドバイス：安心な害虫対策】🐛\n\n・アブラムシ・ハダニ：葉の裏に勢いよく水をかける「葉水」がとても効果的です。水で薄めたお酢や牛乳スプレーも窒息効果があります。\n・アオムシ等：見つけたら割り箸などで優しく捕殺するのが確実です。早めの発見が大切ですので、葉の裏をこまめに観察してくださいね！",
  },
  {
    id: "faq_watering",
    chipLabel: "💧 水やりの頻度",
    question: "夏の水やりのタイミングや頻度を教えてください",
    answer: "【農園アドバイス：水やりのコツ】💧\n\n基本は「朝の涼しい時間帯（早朝〜8時頃）」にたっぷりとあげるのがベストです！\n日中の暑い時間に水をあげるとお湯のようになって根を傷める原因になります。土の表面が乾いて白っぽくなったら、株元にしっかりあげてくださいね🌱",
  },
];


function sanitizePersonalNames(text: string): string {
  if (!text) return "";
  let clean = text;
  clean = clean.replace(/^[^\n\r]{1,30}(?:さん|様|くん|ちゃん)[^\n\r]*(?:こんにちは|ありがとうございます|お疲れ様です|メッセージ)[^\n\r]*[\n\r]*/gm, "");
  clean = clean.replace(/^[^\n\r]*(?:チケット無事|復活しました|改めて)[^\n\r]*[\n\r]*/gm, "");
  clean = clean.replace(/[^ \n\r!！🌱〜]{1,10}(?:さん|様|くん|ちゃん|氏)[、,!\s]*/g, "");
  clean = clean.replace(/(?:竹下|翔|たけした)[^ \n\r!！🌱〜]*(?:さん|様|くん|ちゃん)?[、,!\s]*/g, "");
  clean = clean.trim();
  return clean || text.replace(/[^ \n\r!！🌱〜]{1,10}(?:さん|様|くん|ちゃん|氏)[、,!\s]*/g, "").trim();
}

export default function StudentTalkView({
  journals = [],
  studentName = "受講生",
  studentId,
  customDailyLimit = DEFAULT_DAILY_TICKETS,
  planType = "limited",
}: StudentTalkViewProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // 🌟【新機能】送信前確認モーダル ＆ 複数ナレッジ一致 State 🌟
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCheckingKnowledge, setIsCheckingKnowledge] = useState(false);
  const [matchedKnowledgeList, setMatchedKnowledgeList] = useState<MatchedKnowledgeItem[]>([]);

  // 検索機能 State
  const [showSearch, setShowSearch] = useState(false);
  const [searchMode, setSearchMode] = useState<"jump" | "list">("jump");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // AI相談チケット State
  const [ticketState, setTicketState] = useState(() =>
    getTicketState(studentId || "default", customDailyLimit, planType)
  );

  useEffect(() => {
    const current = getTicketState(studentId || "default", customDailyLimit, planType);
    setTicketState(current);
  }, [studentId, customDailyLimit, planType]);

  // 1. 初回ロード (ログイン中の生徒自身の会話のみを厳格に取得)
  const loadChatHistory = async () => {
    try {
      let targetList: any[] = [];

      if (studentId) {
        const { data: dbJournals } = await supabase
          .from("journals")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: true });

        // 自分のデータのみを使用（0件なら0件のまま。他人の会話には絶対にフォールバックしない）
        targetList = dbJournals || [];
      } else if (journals && journals.length > 0) {
        // studentId 未設定の場合でも、他人のデータ混入を防止
        targetList = journals.filter((j: any) => !j.student_id || j.student_id === "student_default");
      }

      const formatted: MessageItem[] = [];

      formatted.push({
        id: "welcome_msg",
        sender: "teacher",
        text: "こんにちは、" + studentName + "さん！🌱\n農家のしるべぇ(農業AI)です。\n\n野菜の育て方や土作り、今日のお天気、日々のちょっとしたお話まで、何でも気軽にチャットしてくださいね🧑‍🌾",
        timestamp: "現在",
      });

      (targetList || []).forEach((j: any) => {
        const c = (j.content || "").trim();

        // 🌟 入力欄から送信した相談・質問以外の「畝作業記録」「タスク完了報告」「システム通知」を完全に除外 🌟
        if (
          !c ||
          c === "テスト" ||
          c === "○○困ってます" ||
          c.startsWith("【畝") ||
          c.includes("【畝 ") ||
          c.includes("【畝") ||
          c.startsWith("【収穫") ||
          c.includes("【収穫完了報告】") ||
          c.startsWith("【差し戻し") ||
          c.startsWith("【承認") ||
          c.startsWith("【全体お知らせ") ||
          c.includes("を完了報告しました") ||
          c.includes("タスク完了") ||
          (j.task_title && !j.reply && (c.startsWith("【") || c.includes("完了")))
        ) {
          return;
        }

        if (j.content) {
          formatted.push({
            id: "q_" + j.id,
            sender: "student",
            text: j.content,
            timestamp: j.created_at
              ? new Date(j.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
              : (j.date || "過去のメッセージ"),
          });
        }
        if (j.reply) {
          formatted.push({
            id: "a_" + j.id,
            sender: "teacher",
            text: j.reply,
            timestamp: j.created_at
              ? new Date(j.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
              : (j.date || "回答済み"),
          });
        }
      });

      setMessages(formatted);
    } catch (e) {
      console.error("loadChatHistory error:", e);
    }
  };

  useEffect(() => {
    loadChatHistory();
  }, [studentName, studentId]);

  const scrollToBottom = () => {
    if (!searchKeyword.trim() && !showSearch) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // 検索ロジック
  const matchedMessageIds = useMemo(() => {
    if (!searchKeyword.trim()) return [];
    const q = searchKeyword.trim().toLowerCase();
    return messages
      .filter((m) => m.text.toLowerCase().includes(q))
      .map((m) => m.id);
  }, [messages, searchKeyword]);

  useEffect(() => {
    setCurrentMatchIndex(0);
    if (matchedMessageIds.length > 0) {
      jumpToMessage(matchedMessageIds[0]);
    }
  }, [searchKeyword, matchedMessageIds.length]);

  const jumpToMessage = (messageId: string) => {
    const el = messageRefs.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handlePrevMatch = () => {
    if (matchedMessageIds.length === 0) return;
    const nextIdx = (currentMatchIndex - 1 + matchedMessageIds.length) % matchedMessageIds.length;
    setCurrentMatchIndex(nextIdx);
    jumpToMessage(matchedMessageIds[nextIdx]);
  };

  const handleNextMatch = () => {
    if (matchedMessageIds.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matchedMessageIds.length;
    setCurrentMatchIndex(nextIdx);
    jumpToMessage(matchedMessageIds[nextIdx]);
  };

  const studentQuestionsList = useMemo(() => {
    return messages
      .filter((m) => m.sender === "student")
      .map((m, idx) => {
        const mIdx = messages.findIndex((orig) => orig.id === m.id);
        const replyMsg = mIdx >= 0 && messages[mIdx + 1]?.sender === "teacher" ? messages[mIdx + 1] : null;
        return {
          id: m.id,
          question: m.text,
          timestamp: m.timestamp,
          replyText: replyMsg ? replyMsg.text : null,
          number: idx + 1,
        };
      })
      .reverse();
  }, [messages]);

  // 🌟 2. 送信ボタン押下時: ナレッジDBを厳格検索してモーダルを開く 🌟
  const handleOpenConfirm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;

    // 秘密の呪文判定
    if (isSecretTicketSpell(text)) {
      executeSendMessage(false);
      return;
    }

    setIsCheckingKnowledge(true);
    setMatchedKnowledgeList([]);

    try {
      // サーバー側の厳格ナレッジ検索APIを呼び出し
      const res = await fetch("/api/chat/check-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.matches && Array.isArray(data.matches)) {
          setMatchedKnowledgeList(data.matches);
        }
      }
    } catch (err) {
      console.warn("Knowledge pre-check error:", err);
    } finally {
      setIsCheckingKnowledge(false);
      setShowConfirmModal(true);
    }
  };

  // 🌟 3. 選択した過去ナレッジを無料で見る（チケット非消費） 🌟
  const handleUseFreeKnowledge = (item: MatchedKnowledgeItem) => {
    setShowConfirmModal(false);

    const timeStr = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    const userMsgId = "user_" + Date.now();

    const studentMsg: MessageItem = {
      id: userMsgId,
      sender: "student",
      text: inputText.trim(),
      timestamp: timeStr,
    };

    const cleanAnswer = sanitizePersonalNames(item.answer);
    const replyMsg: MessageItem = {
      id: "kn_" + (Date.now() + 1),
      sender: "teacher",
      text: cleanAnswer,
      timestamp: timeStr,
      isKnowledgeHit: true,
    };

    setMessages((prev) => [...prev, studentMsg, replyMsg]);
    setInputText("");
    setToastMessage("💡 農園ノートの回答を表示しました");
    setShowToast(true);
  };

  // 🌟 4. 新しくチケットを使ってAIに送信する 🌟
  const executeSendMessage = async (forceAi: boolean = false) => {
    setShowConfirmModal(false);
    const text = inputText.trim();
    if (!text || isSending) return;

    const timeStr = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    const userMsgId = "user_" + Date.now();

    const isSpell = isSecretTicketSpell(text);
    const currentTicket = getTicketState(studentId || "default", customDailyLimit, planType);
    const hasTicket = currentTicket.isUnlimited || currentTicket.count > 0;
    const isMemoOnly = !isSpell && !hasTicket;

    const newStudentMsg: MessageItem = {
      id: userMsgId,
      sender: "student",
      text: text,
      timestamp: timeStr,
    };
    setMessages((prev) => [...prev, newStudentMsg]);
    setInputText("");
    setIsSending(true);

    if (isMemoOnly) {
      const updatedStock = addQuestionStock(studentId || "default", text);
      const memoReplyText = "📝【質問メモをストック（追記）しました】🌱\n\n本日のAI相談チケットはお休みですが、思いついた質問をメモとして書き足してまとめておきました！\n\n明日チケットが復活した際などに、下の【入力欄にセット】ボタンを押してまとめてAIに相談してくださいね✨";

      const memoSystemMsg: MessageItem = {
        id: "stock_" + Date.now(),
        sender: "teacher",
        text: memoReplyText,
        timestamp: timeStr,
        stockItems: updatedStock,
      };

      setMessages((prev) => [...prev, memoSystemMsg]);
      setToastMessage("📝 質問メモをストックしました（追記・まとめ保存）");
      setShowToast(true);
      setIsSending(false);
      return;
    }

    if (isSpell) {
      const restored = restoreTicketsBySpell(studentId || "default", customDailyLimit);
      setTicketState(restored);
      setToastMessage("✨ 秘密の呪文を発動！チケットが全回復しました（残" + restored.count + "回）");
      setShowToast(true);
    } else if (currentTicket.isUnlimited) {
      setToastMessage("🌟 AIに相談しました（相談し放題プラン）");
      setShowToast(true);
    } else if (hasTicket) {
      const consumed = consumeTicket(studentId || "default", customDailyLimit, planType);
      setTicketState(consumed);
      clearQuestionStock(studentId || "default");
      setToastMessage("🎟️ チケットを使って相談しました（本日残り" + consumed.count + "回）");
      setShowToast(true);
    }

    const recentHistory = messages
      .filter((m) => m.id !== "welcome_msg" && !m.id.startsWith("bot_err_"))
      .slice(-6)
      .map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

    try {
      const res = await fetch("/api/chat/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          studentName: studentName,
          studentId: studentId,
          history: recentHistory,
          isMemoOnly: false,
          isSpell: isSpell,
        }),
      });

      if (!res.ok) throw new Error("チャットサーバーの応答に失敗しました");

      const data = await res.json();
      const aiMsg: MessageItem = {
        id: "ai_" + Date.now(),
        sender: "teacher",
        text: data.reply || "メッセージを受け付けました。",
        timestamp: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
        referencedQa: data.referencedQa,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error("Chat sending error:", err);
      const fallbackMsg: MessageItem = {
        id: "bot_err_" + Date.now(),
        sender: "teacher",
        text: "【しるべぇ】メッセージを受け付けました！次回来園時に講師より詳しくお伝えしますね🧑‍🌾",
        timestamp: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsSending(false);
    }
  };

  // プリセットFAQタップ
  const handleQuickFaqClick = (faqId: string) => {
    const faq = PRESET_FAQS.find((f) => f.id === faqId);
    if (!faq) return;

    const timeStr = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    const studentMsg: MessageItem = {
      id: "faq_q_" + Date.now(),
      sender: "student",
      text: faq.question,
      timestamp: timeStr,
    };
    const replyMsg: MessageItem = {
      id: "faq_a_" + (Date.now() + 1),
      sender: "teacher",
      text: faq.answer,
      timestamp: timeStr,
      isKnowledgeHit: true,
    };

    setMessages((prev) => [...prev, studentMsg, replyMsg]);
    setToastMessage("💡 よくある質問のためチケットを消費せずに回答しました！");
    setShowToast(true);
  };

  // ストックメモを入力欄にセット
  const handleApplyStockToInput = (stockItems: string[]) => {
    const formatted = formatStockText(stockItems);
    setInputText(formatted);
    setToastMessage("📋 ストックした質問を入力欄にセットしました！");
    setShowToast(true);
  };

  // ストックメモをクリップボードにコピー
  const handleCopyStockToClipboard = async (stockItems: string[]) => {
    const formatted = formatStockText(stockItems);
    try {
      await navigator.clipboard.writeText(formatted);
      setToastMessage("📋 ストックした質問をクリップボードにコピーしました！");
      setShowToast(true);
    } catch (e) {
      setInputText(formatted);
      setToastMessage("📋 入力欄にセットしました");
      setShowToast(true);
    }
  };

  // 検索ハイライト
  const renderHighlightedText = (text: string, keyword: string) => {
    if (!keyword.trim()) return text;
    const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^$${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <mark key={i} className="bg-amber-300 text-amber-950 px-1 py-0.5 rounded font-black shadow-2xs">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex flex-col h-full flex-1 min-h-0 bg-white rounded-3xl border border-gray-200/90 shadow-lg overflow-hidden relative">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* 🌟 1. ヘッダー 🌟 */}
      <div className="px-4 py-3 bg-gradient-to-r from-emerald-800 to-[#1c4d21] text-white flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-amber-400 border border-amber-200 flex items-center justify-center text-base shadow-2xs">
            🧑‍🌾
          </div>
          <div>
            <h3 className="font-extrabold text-sm tracking-wide">農家のしるべぇ(農業AI)に相談</h3>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowSearch(!showSearch);
            if (showSearch) setSearchKeyword("");
          }}
          className={"px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer " + (
            showSearch ? "bg-white text-emerald-900 shadow-xs" : "bg-black/20 hover:bg-black/30 text-emerald-100"
          )}
          title="会話履歴を検索"
        >
          <span>🔍</span>
          <span className="hidden sm:inline">履歴検索</span>
        </button>
      </div>

      {/* 🌟 2. 検索バー 🌟 */}
      {showSearch && (
        <div className="bg-emerald-50/90 border-b border-emerald-200 p-2.5 space-y-2 shrink-0 animate-fade-in shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex space-x-1 bg-emerald-100/80 p-0.5 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setSearchMode("jump")}
                className={"px-2.5 py-1 rounded-lg transition cursor-pointer " + (
                  searchMode === "jump" ? "bg-white text-emerald-900 shadow-2xs" : "text-emerald-700 hover:text-emerald-900"
                )}
              >
                🔀 キーワード検索
              </button>
              <button
                type="button"
                onClick={() => setSearchMode("list")}
                className={"px-2.5 py-1 rounded-lg transition cursor-pointer " + (
                  searchMode === "list" ? "bg-white text-emerald-900 shadow-2xs" : "text-emerald-700 hover:text-emerald-900"
                )}
              >
                📜 過去の質問一覧 ({studentQuestionsList.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowSearch(false);
                setSearchKeyword("");
              }}
              className="text-xs text-gray-400 hover:text-gray-600 font-bold px-2 py-0.5 cursor-pointer"
            >
              ✕ 閉じる
            </button>
          </div>

          {searchMode === "jump" ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="探したい言葉を入力 (例: トマト, 水やり, ハダニ)..."
                autoFocus
                className="flex-1 px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium placeholder-gray-400"
              />

              {matchedMessageIds.length > 0 ? (
                <div className="flex items-center space-x-1 shrink-0">
                  <span className="text-[11px] font-black text-emerald-900 bg-white px-2 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                    {currentMatchIndex + 1} / {matchedMessageIds.length} 件
                  </span>
                  <button
                    type="button"
                    onClick={handlePrevMatch}
                    className="p-1.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMatch}
                    className="p-1.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    ▶
                  </button>
                </div>
              ) : searchKeyword.trim() ? (
                <span className="text-[11px] text-gray-500 font-bold shrink-0">一致なし</span>
              ) : null}
            </div>
          ) : (
            <p className="text-[11px] text-emerald-800 font-medium">
              💡 過去に送信した質問一覧です。タップするとその会話へジャンプします。
            </p>
          )}
        </div>
      )}

      {/* 🌟 3. メインチャットエリア 🌟 */}
      {showSearch && searchMode === "list" ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-emerald-50/30 animate-fade-in">
          {studentQuestionsList.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              まだ質問履歴はありません。
            </div>
          ) : (
            studentQuestionsList.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setShowSearch(false);
                  setTimeout(() => jumpToMessage(item.id), 100);
                }}
                className="bg-white p-3.5 rounded-2xl border border-emerald-100/90 shadow-2xs hover:shadow-md hover:border-emerald-400 cursor-pointer transition group text-left"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-md">
                    質問 #{item.number}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">{item.timestamp}</span>
                </div>
                <p className="text-xs text-gray-900 font-extrabold group-hover:text-emerald-800 line-clamp-2 leading-snug">
                  {item.question}
                </p>
                {item.replyText && (
                  <p className="text-[11px] text-gray-500 font-normal line-clamp-1 mt-1 border-t border-gray-100 pt-1">
                    💬 {item.replyText}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#fcfbf9]">
          {messages.map((msg) => {
            const isMe = msg.sender === "student";
            const isTargetMatch =
              searchKeyword.trim() &&
              matchedMessageIds[currentMatchIndex] === msg.id;

            return (
              <div
                key={msg.id}
                ref={(el) => {
                  messageRefs.current[msg.id] = el;
                }}
                className={"flex flex-col " + (isMe ? "items-end" : "items-start") + " space-y-1 animate-fade-in transition-all duration-300 " + (
                  isTargetMatch ? "scale-[1.02] p-1 bg-amber-100/60 rounded-3xl border-2 border-amber-400 shadow-md" : ""
                )}
              >
                <div className={"flex items-start max-w-[88%] " + (isMe ? "flex-row-reverse" : "flex-row") + " space-x-2"}>
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center text-xs shadow-2xs shrink-0 mt-0.5 mr-1.5">
                      🧑‍🌾
                    </div>
                  )}

                  <div
                    className={"p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs transition-all " + (
                      isMe
                        ? "bg-[#1c4d21] text-white rounded-tr-none font-medium"
                        : "bg-white text-gray-800 border border-gray-200/90 rounded-tl-none font-normal"
                    )}
                  >
                    <p className="whitespace-pre-wrap">
                      {renderHighlightedText(msg.text, searchKeyword)}
                    </p>

                    {/* 質問ストック・累積メモボックス */}
                    {!isMe && msg.stockItems && msg.stockItems.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-amber-200/80 bg-amber-50/90 p-3 rounded-2xl border text-amber-950 space-y-2">
                        <span className="font-extrabold text-[11px] flex items-center gap-1">
                          <span>📋</span>
                          <span>現在の質問ストック ({msg.stockItems.length}件):</span>
                        </span>

                        <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200/60 text-xs text-gray-900 font-medium whitespace-pre-wrap leading-relaxed">
                          {formatStockText(msg.stockItems)}
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleApplyStockToInput(msg.stockItems || [])}
                            className="flex-1 py-1.5 px-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold text-[11px] shadow-xs transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>📥 入力欄にセット</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyStockToClipboard(msg.stockItems || [])}
                            className="py-1.5 px-2.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-[11px] shadow-2xs transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>📄 コピー</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 📚 参照した過去の講師Q&Aナレッジ (AI新規生成時のみ表示し、ルールベース直答時は重複防止) */}
                    {!isMe && !msg.isKnowledgeHit && msg.referencedQa && msg.referencedQa.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-gray-100 text-[10.5px] text-emerald-800 bg-emerald-50/80 p-2 rounded-xl">
                        <span className="font-bold block mb-0.5">💡 参考にした過去の講師回答 (重み1.2):</span>
                        <p className="text-gray-600 font-normal italic">
                          「{msg.referencedQa[0].answer.length > 60 ? msg.referencedQa[0].answer.slice(0, 60) + "..." : msg.referencedQa[0].answer}」
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <span className={"text-[9.5px] text-gray-400 font-bold px-1 " + (isMe ? "mr-1" : "ml-9")}>
                  {msg.timestamp}
                </span>
              </div>
            );
          })}

          {isSending && (
            <div className="flex items-center space-x-2 text-xs text-gray-500 font-bold ml-1 animate-pulse">
              <div className="w-6 h-6 rounded-full bg-amber-300 flex items-center justify-center text-xs">
                🧑‍🌾
              </div>
              <div className="bg-white px-3 py-2 rounded-2xl border border-gray-200 shadow-2xs flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.4s]"></span>
                <span className="text-[10.5px] text-emerald-900 font-bold ml-1">
                  {ticketState.isUnlimited || ticketState.count > 0 ? "AI回答を生成中..." : "メモをストック中..."}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* 🌟 4. 定型文サジェストチップ (無料・チケット非消費) 🌟 */}
      <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200/80 flex items-center space-x-1.5 overflow-x-auto text-[11px] font-bold text-gray-600 shrink-0 scrollbar-none">
        {PRESET_FAQS.map((faq) => (
          <button
            key={faq.id}
            type="button"
            onClick={() => handleQuickFaqClick(faq.id)}
            title="チケットを消費せずに即座に回答を確認できます"
            className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-200/80 rounded-full shrink-0 shadow-2xs transition active:scale-95 cursor-pointer flex items-center gap-1"
          >
            <span>{faq.chipLabel}</span>
            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded-full font-bold">無料</span>
          </button>
        ))}
      </div>

      {/* 🌟 5. 入力バー ＆ 送信ボタン ＆ 丸3つ残数インジケーター 🌟 */}
      <form
        onSubmit={handleOpenConfirm}
        className="p-2 bg-white border-t border-gray-200 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            ticketState.isUnlimited || ticketState.count > 0
              ? "栽培の質問や相談を入力..."
              : "次回質問用のメモを入力 (ストックに追記)..."
          }
          disabled={isSending || isCheckingKnowledge}
          className="flex-1 min-w-0 px-3.5 py-2.5 bg-gray-100 hover:bg-gray-50 focus:bg-white border border-gray-300 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] transition placeholder-gray-400"
        />

        <div className="flex flex-col items-center justify-center space-y-1 shrink-0">
          <button
            type="submit"
            disabled={!inputText.trim() || isSending || isCheckingKnowledge}
            className={"w-9 h-9 rounded-2xl font-black transition flex items-center justify-center shrink-0 cursor-pointer shadow-xs active:scale-95 " + (
              !inputText.trim() || isSending || isCheckingKnowledge
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : ticketState.isUnlimited || ticketState.count > 0
                ? "bg-[#1c4d21] text-white hover:bg-[#153e19]"
                : "bg-amber-700 text-white hover:bg-amber-800"
            )}
            title="相談内容を確認して送信"
          >
            {isCheckingKnowledge ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <svg className="w-4 h-4 fill-current transform rotate-45 -translate-y-0.5 translate-x-0.5" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>

          <div className="flex items-center space-x-1" title={"本日残り " + ticketState.count + " / 3 回"}>
            {Array.from({ length: 3 }).map((_, i) => (
              <span
                key={i}
                className={"w-1.5 h-1.5 rounded-full transition-all " + (
                  ticketState.isUnlimited
                    ? "bg-emerald-600 scale-110"
                    : i < ticketState.count
                    ? "bg-emerald-600 shadow-2xs scale-110"
                    : "bg-gray-300"
                )}
              ></span>
            ))}
          </div>
        </div>
      </form>

      {/* 🌟 6. スマート送信前確認モーダル (複数候補スクロール選択 ＆ キーワード明示対応) 🌟 */}
      {showConfirmModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-gray-200 space-y-3.5 text-left max-h-[90vh] flex flex-col">
            
            {/* 💡 パターンA: 過去の農園知識（1つ以上）が見つかった場合 */}
            {matchedKnowledgeList.length > 0 ? (
              <>
                <div className="flex items-center space-x-2 text-emerald-950 shrink-0">
                  <span className="text-2xl">💡</span>
                  <div>
                    <h4 className="font-black text-sm text-emerald-900 leading-tight">
                      似た回答が農園ノートに見つかりました！
                    </h4>
                  </div>
                </div>

                {/* スクロール可能な候補リスト */}
                <div className="overflow-y-auto space-y-2.5 max-h-56 pr-0.5 py-1">
                  {matchedKnowledgeList.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="bg-emerald-50/90 p-3 rounded-2xl border border-emerald-200/90 shadow-2xs space-y-2 hover:border-emerald-400 transition"
                    >
                      {/* 一致キーワードバッジ */}
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[9.5px] font-black text-emerald-900 bg-white px-1.5 py-0.5 rounded-md border border-emerald-200 shadow-2xs">
                          🏷️ 一致: {item.matchedKeywords.join(", ")}
                        </span>
                      </div>

                      {/* 過去質問 */}
                      <div className="text-xs">
                        <span className="text-[10px] font-bold text-gray-500 block">Q. 過去の質問:</span>
                        <p className="font-extrabold text-gray-900 line-clamp-2">「{item.question}」</p>
                      </div>

                      {/* 回答プレビュー */}
                      <div className="text-[11px] text-gray-700 bg-white/80 p-2 rounded-xl border border-emerald-100">
                        <span className="text-[10px] font-bold text-emerald-800 block mb-0.5">A. 回答の抜粋:</span>
                        <p className="line-clamp-2 leading-relaxed italic">
                          {sanitizePersonalNames(item.answer)}
                        </p>
                      </div>

                      {/* この回答を見るボタン */}
                      <button
                        type="button"
                        onClick={() => handleUseFreeKnowledge(item)}
                        className="w-full py-2 bg-[#1c4d21] hover:bg-[#153e19] text-white font-black text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1"
                      >
                        <span>✨ この回答を見る</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* 下部のアクションボタン */}
                <div className="pt-2 border-t border-gray-100 space-y-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => executeSendMessage(true)}
                    className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl transition cursor-pointer text-center"
                  >
                    新しくAIに相談 (残{ticketState.count}回)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs rounded-xl transition cursor-pointer text-center"
                  >
                    書き直す
                  </button>
                </div>
              </>
            ) : (
              /* 🌱 パターンB: 過去の知識がなく、チケットを使って新しくAI相談する場合 */
              <>
                <div className="flex items-center space-x-2 text-emerald-950 shrink-0">
                  <span className="text-2xl">{ticketState.isUnlimited || ticketState.count > 0 ? "🎟️" : "📝"}</span>
                  <div>
                    <h4 className="font-black text-sm text-gray-900 leading-tight">
                      {ticketState.isUnlimited || ticketState.count > 0
                        ? "チケットを使ってAIに相談しますか？"
                        : "質問ストックにメモを追記しますか？"}
                    </h4>
                    <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                      {ticketState.isUnlimited
                        ? "過去のノートに一致がないため、AIに新しく相談します"
                        : ticketState.count > 0
                        ? `過去のノートに一致がないため、チケットを1枚消費します (本日残り${ticketState.count}回)`
                        : "AI枠終了のため、次回用ストックメモに追記保存されます"}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10.5px] font-bold text-gray-500 block">📝 相談内容:</span>
                  <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80 text-xs text-gray-800 max-h-36 overflow-y-auto whitespace-pre-wrap font-medium leading-relaxed">
                    {inputText}
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer text-center"
                  >
                    書き直す
                  </button>
                  <button
                    type="button"
                    onClick={() => executeSendMessage(false)}
                    className={"flex-1 py-2.5 font-bold text-xs rounded-xl shadow-md transition cursor-pointer text-center text-white " + (
                      ticketState.isUnlimited || ticketState.count > 0
                        ? "bg-[#1c4d21] hover:bg-[#153e19]"
                        : "bg-amber-700 hover:bg-amber-800"
                    )}
                  >
                    {ticketState.isUnlimited || ticketState.count > 0 ? "はい、相談する" : "はい、メモを追記"}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
