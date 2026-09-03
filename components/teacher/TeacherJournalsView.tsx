"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";
import SlideSettingsModal, { SlideSettings } from "@/components/teacher/SlideSettingsModal";

interface JournalItem {
  id: string;
  student_id: string;
  studentName?: string;
  studentAvatar?: string;
  created_at: string;
  taskTitle?: string;
  content: string;
  reply?: string;
  is_approved: boolean;
}

export interface SlideItemRecord {
  itemType: "record";
  id: string;
  studentName: string;
  studentAvatar: string;
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

export interface SlideItemDateCard {
  itemType: "date_card";
  id: string;
  dateKey: string;
  displayDate: string;
  dayOfWeek: string;
  isToday: boolean;
  timestamp: number;
}

export type SlideItem = SlideItemRecord | SlideItemDateCard;

interface TeacherJournalsViewProps {
  onNavigateToFarm?: (plotCode?: string, farmId?: string) => void;
}

// 投稿日時・日付情報の抽出ヘルパー
const extractDateInfo = (dateStrOrIso?: string) => {
  const dateObj = dateStrOrIso ? new Date(dateStrOrIso) : new Date();
  const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;

  const y = validDate.getFullYear();
  const m = String(validDate.getMonth() + 1).padStart(2, "0");
  const d = String(validDate.getDate()).padStart(2, "0");
  const dateKey = `${y}-${m}-${d}`;

  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  const dayOfWeek = dayNames[validDate.getDay()];
  const displayDate = `${validDate.getMonth() + 1}月${validDate.getDate()}日`;

  const todayObj = new Date();
  const todayKey = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, "0")}-${String(todayObj.getDate()).padStart(2, "0")}`;
  const isToday = dateKey === todayKey;

  const timeStr = validDate.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    timestamp: validDate.getTime(),
    dateKey,
    displayDate,
    dayOfWeek,
    isToday,
    timeStr,
  };
};

export default function TeacherJournalsView({ onNavigateToFarm }: TeacherJournalsViewProps) {
  const [journals, setJournals] = useState<JournalItem[]>([]);
  const [slideColumns, setSlideColumns] = useState<SlideItemRecord[][]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [replyInput, setReplyInput] = useState<{ [key: string]: string }>({});
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [showIndexModal, setShowIndexModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // 🌟【100人規模対応】スマートフィルター State 🌟
  const [filterTab, setFilterTab] = useState<"unreplied" | "all" | "ai_answered" | "approved">("unreplied");
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [approveOnReply, setApproveOnReply] = useState<{ [key: string]: boolean }>({});

  // 🌟【新機能】スライド表示設定 State (各生徒直近3回分・ソート順・速度) 🌟
  const [slideSettings, setSlideSettings] = useState<SlideSettings>({
    sortBy: "newest",
    limitPerStudent: 3, // 各生徒 直近3回分 (デフォルト)
    speed: "normal",
  });
  const [showSlideSettingsModal, setShowSlideSettingsModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nouato_slide_settings");
      if (saved) {
        try {
          setSlideSettings(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, []);

  const handleSaveSlideSettings = (newSettings: SlideSettings) => {
    setSlideSettings(newSettings);
    if (typeof window !== "undefined") {
      localStorage.setItem("nouato_slide_settings", JSON.stringify(newSettings));
    }
    setToastMessage("⚙️ スライド表示設定を更新・適用しました！");
    setShowToast(true);
  };

  // 🌟【新スライド制御】requestAnimationFrame による精密速度＆逆方向スライド制御 🌟
  const sliderRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef<number>(0);
  const slideModeRef = useRef<"forward" | "paused" | "reverse">("forward");
  const [activeSlideStatus, setActiveSlideStatus] = useState<"forward" | "paused" | "reverse">("forward");

  const fetchJournals = async (isInitial: boolean = false) => {
    if (isInitial) {
      setLoading(true);
    }
    try {
      const { data: journalData, error: journalError } = await supabase
        .from("journals")
        .select("*")
        .order("created_at", { ascending: false });

      if (journalError) {
        console.warn("Journals fetch info:", journalError.message || journalError);
        setJournals([]);
        return;
      }

      if (!journalData || journalData.length === 0) {
        setJournals([]);
        return;
      }

      const studentIds = Array.from(new Set(journalData.map((j: any) => j.student_id).filter(Boolean)));
      let userMap: { [key: string]: string } = {};

      if (studentIds.length > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, email, full_name")
          .in("id", studentIds);

        if (usersData) {
          usersData.forEach((u: any) => {
            if (u.id) {
              userMap[u.id] = u.full_name || (u.email ? u.email.split("@")[0] : "竹下 翔");
            }
          });
        }
      }

      // 🌟 単なるシステムのタスク完了報告や収穫完了報告を除外し、「生徒からの手入力気づきメモ・相談」のみを厳選抽出 🌟
      const filteredData = journalData.filter((j: any) => {
        const content = (j.content || "").trim();
        if (!content) return false;
        if (
          content.includes("【収穫完了報告】") ||
          content.includes("【差し戻し通知】") ||
          content.includes("を完了報告しました") ||
          content === "（コメントなし）"
        ) {
          return false;
        }
        return true;
      });

      const formatted: JournalItem[] = filteredData.map((j: any) => {
        const name = userMap[j.student_id] || "受講生徒";
        return {
          id: j.id,
          student_id: j.student_id,
          studentName: name,
          studentAvatar: name.slice(0, 2).toUpperCase(),
          created_at: j.created_at
            ? new Date(j.created_at).toLocaleString("ja-JP", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "最近",
          taskTitle: j.task_title || "💡 気づきメモ・質問相談",
          content: j.content,
          reply: j.reply || "",
          is_approved: j.is_approved || false,
        };
      });

      setJournals(formatted);
    } catch (e) {
      console.error("Journals error exception:", e);
      setJournals([]);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  // 返信送信＆再編集保存 (返信と同時にナレッジ承認も保存可能)
  const handleSendReply = async (id: string) => {
    const text = replyInput[id];
    if (!text?.trim()) return;

    const shouldApprove = approveOnReply[id] || false;

    const { error } = await supabase
      .from("journals")
      .update({
        reply: text,
        ...(shouldApprove ? { is_approved: true } : {}),
      })
      .eq("id", id);

    if (error) {
      setToastMessage("返信の保存に失敗しました: " + error.message);
    } else {
      setJournals(
        journals.map((j) =>
          j.id === id
            ? { ...j, reply: text, ...(shouldApprove ? { is_approved: true } : {}) }
            : j
        )
      );
      setEditingReplyId(null);
      setToastMessage(
        shouldApprove
          ? "💬 回答を送信し、★ AIナレッジとして承認保存しました！"
          : "💬 生徒への回答メッセージを更新・保存しました！"
      );
    }
    setShowToast(true);
  };

  // 返信の再編集モードを開く
  const handleStartEditReply = (journal: JournalItem) => {
    setEditingReplyId(journal.id);
    setReplyInput({ ...replyInput, [journal.id]: journal.reply || "" });
  };

  // AIナレッジ化（承認）
  const handleToggleApprove = async (id: string, currentApproved: boolean) => {
    const nextApproved = !currentApproved;
    const { error } = await supabase
      .from("journals")
      .update({ is_approved: nextApproved })
      .eq("id", id);

    if (error) {
      setToastMessage("承認状態の更新に失敗しました: " + error.message);
    } else {
      setJournals(
        journals.map((j) => (j.id === id ? { ...j, is_approved: nextApproved } : j))
      );
      setToastMessage(
        nextApproved
          ? "✨ AI知識として承認保存しました"
          : "承認を取り消しました"
      );
    }
    setShowToast(true);
  };

  // 🌟 日誌・相談ログの削除 (不要データやテストデータの完全クリーンアップ) 🌟
  const handleDeleteJournal = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("この日記（相談ログ）を削除してもよろしいですか？\n削除するとAIナレッジの参照データからも完全に除外されます。")) {
      return;
    }

    try {
      const { error } = await supabase.from("journals").delete().eq("id", id);
      if (error) {
        setToastMessage("削除に失敗しました: " + error.message);
      } else {
        const nextList = journals.filter((j) => j.id !== id);
        setJournals(nextList);
        setToastMessage("🗑️ 日記データを削除しました");
      }
    } catch (err: any) {
      setToastMessage("削除エラー: " + err.message);
    }
    setShowToast(true);
  };

  // 🌟 緊急度・要注意キーワード判定 🌟
  const isUrgentJournal = (content: string) => {
    const urgentKeywords = ["枯れ", "虫", "病", "腐", "黄", "異変", "倒れ", "食べられ", "斑点", "カビ", "元気がない", "しおれ", "害虫"];
    return urgentKeywords.some((k) => content.includes(k));
  };

  // 🌟 生徒一覧（ドロップダウン用） 🌟
  const studentList = Array.from(
    new Set(journals.map((j) => JSON.stringify({ id: j.student_id, name: j.studentName })))
  ).map((s) => JSON.parse(s));

  // 🌟 フィルタリング適用後の日誌リスト 🌟
  const filteredJournals = journals.filter((j) => {
    // 1. タブフィルター
    if (filterTab === "unreplied") {
      if (j.reply && j.reply.trim().length > 0) return false;
    } else if (filterTab === "ai_answered") {
      if (!j.reply || j.reply.trim().length === 0) return false;
    } else if (filterTab === "approved") {
      if (!j.is_approved) return false;
    }

    // 2. 生徒フィルター
    if (selectedStudentFilter !== "all" && j.student_id !== selectedStudentFilter) {
      return false;
    }

    // 3. 検索クエリ
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchContent = j.content.toLowerCase().includes(q);
      const matchReply = (j.reply || "").toLowerCase().includes(q);
      const matchStudent = (j.studentName || "").toLowerCase().includes(q);
      const matchTitle = (j.taskTitle || "").toLowerCase().includes(q);
      if (!matchContent && !matchReply && !matchStudent && !matchTitle) {
        return false;
      }
    }

    return true;
  });

  // 未返信件数のカウント（バッジ用）
  const unrepliedCount = journals.filter((j) => !j.reply || !j.reply.trim()).length;
  const approvedCount = journals.filter((j) => j.is_approved).length;

  // ページめくり処理 (フィルタリング後のリストに連動)
  const totalPages = filteredJournals.length;
  const currentJournal = filteredJournals[currentPage] || filteredJournals[0];

  // フィルター変更時にページ番号が範囲外にならないようリセット
  useEffect(() => {
    setCurrentPage(0);
  }, [filterTab, selectedStudentFilter, searchQuery]);

  const handlePrevPage = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1);
  };

  // 🌟【実データ完全連動】下部自動スライド用: 生徒の最新投稿（各生徒直近3回分抽出 ＆ ソート並べ替え ＆ 2行化） 🌟
  const fetchCropRecords = useCallback(async () => {
    try {
      // 1. crop_records から生徒の観察ノート・現場報告を取得
      const { data: recData } = await supabase
        .from("crop_records")
        .select("*")
        .order("created_at", { ascending: false });

      // 2. journals から生徒の手入力日誌・相談メモを取得
      const { data: jData } = await supabase
        .from("journals")
        .select("*")
        .order("created_at", { ascending: false });

      // 3. ユーザー名の取得
      const { data: usersData } = await supabase
        .from("users")
        .select("id, full_name, email");

      const userMap: { [key: string]: string } = {};
      if (usersData) {
        usersData.forEach((u: any) => {
          if (u.id) {
            userMap[u.id] = u.full_name || (u.email ? u.email.split("@")[0] : "受講生徒");
          }
        });
      }

      let allRecords: SlideItemRecord[] = [];

      if (recData && recData.length > 0) {
        recData.forEach((r: any, idx: number) => {
          const rawDate = r.created_at || r.date;
          const { timestamp, dateKey, timeStr } = extractDateInfo(rawDate);
          const studentName = r.student_name || (r.student_id && userMap[r.student_id]) || "竹下 翔";

          let cleanNotes = r.notes || "観察記録を送信しました。";
          let imgUrl = r.photo_url || r.image_url || undefined;
          const imgMatch = cleanNotes.match(/\n?\[IMG:([\s\S]+?)\]/);
          if (imgMatch) {
            imgUrl = imgMatch[1];
            cleanNotes = cleanNotes.replace(/\n?\[IMG:[\s\S]+?\]/, "").trim();
          }

          allRecords.push({
            itemType: "record",
            id: r.id || `rec_${idx}`,
            studentName,
            studentAvatar: studentName.slice(0, 1),
            title: Array.isArray(r.work_types) ? r.work_types.join(", ") : (r.crop_name || "作業記録"),
            content: cleanNotes,
            imageUrl: imgUrl,
            harvestAmount: r.harvest_amount || undefined,
            dateStr: dateKey,
            timeStr,
            timestamp,
            plotCode: r.plot_code || "B3",
            farmId: r.farm_id,
          });
        });
      }

      if (jData && jData.length > 0) {
        jData
          .filter((j: any) => {
            const c = (j.content || "").trim();
            return c && 
              !c.includes("【収穫完了報告】") && 
              !c.includes("【差し戻し通知】") && 
              !c.includes("を完了報告しました") && 
              c !== "（コメントなし）";
          })
          .forEach((j: any, idx: number) => {
            const rawDate = j.created_at;
            const { timestamp, dateKey, timeStr } = extractDateInfo(rawDate);
            const studentName = (j.student_id && userMap[j.student_id]) || "竹下 翔";

            if (!allRecords.some((r) => r.content === j.content)) {
              allRecords.push({
                itemType: "record",
                id: j.id || `j_${idx}`,
                studentName,
                studentAvatar: studentName.slice(0, 1),
                title: j.task_title || "💡 質問・相談日誌",
                content: j.content,
                imageUrl: j.image_url || j.photo_url || undefined,
                dateStr: dateKey,
                timeStr,
                timestamp,
                plotCode: "B3",
              });
            }
          });
      }

      // データが少ない場合の初期フォールバック (実稼働初期用)
      if (allRecords.length === 0) {
        const now = Date.now();
        allRecords.push(
          {
            itemType: "record",
            id: "fb_1",
            studentName: "竹下 翔",
            studentAvatar: "竹",
            title: "🌱 水やり・追肥",
            content: "ミニトマトの本葉が順調に展開しています。水やりと液肥の追肥を行いました。",
            imageUrl: undefined,
            dateStr: new Date(now).toLocaleDateString("ja-JP"),
            timeStr: "14:20",
            timestamp: now,
            plotCode: "B3",
          },
          {
            itemType: "record",
            id: "fb_2",
            studentName: "佐藤 健太",
            studentAvatar: "佐",
            title: "✂️ わき芽かき",
            content: "下葉の整理とわき芽かきを実施。日当たりと風通しが大きく改善しました。",
            imageUrl: undefined,
            dateStr: new Date(now).toLocaleDateString("ja-JP"),
            timeStr: "11:45",
            timestamp: now - 3600000 * 2,
            plotCode: "A2",
          },
          {
            itemType: "record",
            id: "fb_3",
            studentName: "高橋 美咲",
            studentAvatar: "高",
            title: "💡 質問相談",
            content: "葉の裏に少し白っぽい斑点を見つけました。これはうどんこ病でしょうか？",
            imageUrl: undefined,
            dateStr: new Date(now - 86400000).toLocaleDateString("ja-JP"),
            timeStr: "16:30",
            timestamp: now - 86400000,
            plotCode: "C1",
          },
          {
            itemType: "record",
            id: "fb_4",
            studentName: "竹下 翔",
            studentAvatar: "竹",
            title: "🥬 収穫記録",
            content: "初収穫！立派なナスとキュウリが収穫できました。",
            harvestAmount: "🍆 ナス 3本, 🥒 2本",
            imageUrl: undefined,
            dateStr: new Date(now - 86400000).toLocaleDateString("ja-JP"),
            timeStr: "09:15",
            timestamp: now - 86400000 - 3600000 * 4,
            plotCode: "B3",
          }
        );
      }

      // 🌟【要件: 各生徒の直近N回分のみに厳密制限 (デフォルト: 直近3回分)】🌟
      const limit = slideSettings.limitPerStudent;
      let filteredByStudentRecords: SlideItemRecord[] = [];

      if (limit > 0) {
        // 生徒ごとにグルーピング
        const studentMap: { [name: string]: SlideItemRecord[] } = {};
        allRecords.forEach((r) => {
          if (!studentMap[r.studentName]) {
            studentMap[r.studentName] = [];
          }
          studentMap[r.studentName].push(r);
        });

        // 各生徒の投稿をタイムスタンプ降順にして直近N件のみ抽出
        Object.values(studentMap).forEach((list) => {
          list.sort((a, b) => b.timestamp - a.timestamp);
          filteredByStudentRecords.push(...list.slice(0, limit));
        });
      } else {
        filteredByStudentRecords = [...allRecords];
      }

      // 🌟【要件: ソート・並べ替えの適用】🌟
      const sortBy = slideSettings.sortBy;
      filteredByStudentRecords.sort((a, b) => {
        if (sortBy === "oldest") {
          return a.timestamp - b.timestamp;
        }
        if (sortBy === "studentName") {
          const nameCmp = a.studentName.localeCompare(b.studentName, "ja");
          if (nameCmp !== 0) return nameCmp;
          return b.timestamp - a.timestamp;
        }
        if (sortBy === "hasImage") {
          const aImg = a.imageUrl ? 1 : 0;
          const bImg = b.imageUrl ? 1 : 0;
          if (bImg !== aImg) return bImg - aImg;
          return b.timestamp - a.timestamp;
        }
        if (sortBy === "hasHarvest") {
          const aH = a.harvestAmount ? 1 : 0;
          const bH = b.harvestAmount ? 1 : 0;
          if (bH !== aH) return bH - aH;
          return b.timestamp - a.timestamp;
        }
        if (sortBy === "isQuestion") {
          const aQ = a.title.includes("相談") || a.title.includes("質問") ? 1 : 0;
          const bQ = b.title.includes("相談") || b.title.includes("質問") ? 1 : 0;
          if (bQ !== aQ) return bQ - aQ;
          return b.timestamp - a.timestamp;
        }
        // デフォルト: newest (最新順)
        return b.timestamp - a.timestamp;
      });

      // 2行（縦2段の列ペア）に整理
      const cols: SlideItemRecord[][] = [];
      for (let i = 0; i < filteredByStudentRecords.length; i += 2) {
        cols.push([filteredByStudentRecords[i], filteredByStudentRecords[i + 1]].filter(Boolean));
      }

      // ループのスムーズさ確保のため、少数の場合は必要十分な長さに複製
      let filledCols = [...cols];
      while (filledCols.length < 8 && filledCols.length > 0) {
        filledCols = [...filledCols, ...cols];
      }

      setSlideColumns(filledCols as any);
    } catch (err) {
      console.error("fetchCropRecords error:", err);
      setSlideColumns([]);
    }
  }, [slideSettings]);

  useEffect(() => {
    fetchJournals(true);
    fetchCropRecords();

    // 🌟 1. 定期自動更新 (10秒ごとに最新投稿・写真をバックグラウンド検知) 🌟
    const interval = setInterval(() => {
      fetchJournals(false);
      fetchCropRecords();
    }, 10000);

    // 🌟 2. BroadcastChannel & CustomEvent によるリアルタイム即時同期 🌟
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("nouato_farm_sync_channel");
      bc.onmessage = () => {
        fetchJournals(false);
        fetchCropRecords();
      };
    } catch (e) {}

    const handleSync = () => {
      fetchJournals(false);
      fetchCropRecords();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("nouato_sync_event", handleSync);
    }

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
      if (typeof window !== "undefined") {
        window.removeEventListener("nouato_sync_event", handleSync);
      }
    };
  }, [fetchCropRecords]);

  // 🌟【要件: 30%低速化 & ホバー一時停止 & 左側ホバーで逆スライド & 設定連動】🌟
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const elapsed = currentTime - lastTime;
      lastTime = currentTime;
      // 60fps 基準正規化 delta
      const delta = Math.min(Math.max(elapsed / 16.667, 0.5), 2.5);

      if (sliderRef.current && trackRef.current) {
        const totalTrackWidth = trackRef.current.scrollWidth;
        const halfWidth = totalTrackWidth / 2;

        let baseSpeed = 0.65;
        if (slideSettings.speed === "slow") baseSpeed = 0.35;
        if (slideSettings.speed === "fast") baseSpeed = 1.1;
        if (slideSettings.speed === "paused") baseSpeed = 0;

        if (halfWidth > 50 && baseSpeed > 0) {
          if (slideModeRef.current === "forward") {
            scrollPosRef.current += baseSpeed * delta;
            if (scrollPosRef.current >= halfWidth) {
              scrollPosRef.current -= halfWidth;
            }
          } else if (slideModeRef.current === "reverse") {
            // 逆方向スライド (左側にマウスがある時のみ)
            scrollPosRef.current -= (baseSpeed * 1.5) * delta;
            if (scrollPosRef.current < 0) {
              scrollPosRef.current += halfWidth;
            }
          }
          // "paused" の時は scrollPos を維持

          sliderRef.current.scrollLeft = scrollPosRef.current;
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [slideColumns.length, slideSettings.speed]);

  // マウス位置判定ハンドラー
  const handleSliderMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const width = rect.width;

    // 左側28%エリアにカーソルがある場合は逆方向スライド
    if (mouseX < width * 0.28) {
      if (slideModeRef.current !== "reverse") {
        slideModeRef.current = "reverse";
        setActiveSlideStatus("reverse");
      }
    } else {
      // それ以外の領域は一時停止
      if (slideModeRef.current !== "paused") {
        slideModeRef.current = "paused";
        setActiveSlideStatus("paused");
      }
    }
  };

  const handleSliderMouseLeave = () => {
    slideModeRef.current = "forward";
    setActiveSlideStatus("forward");
  };



  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* 🌟 1. ヘッダー ＆ スマート操作エリア 🌟 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <span>📖 交換日記帳・相談確認</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            生徒100人規模でも要対応の相談を迷わず確認・返信・ナレッジ化できます。
          </p>
        </div>

        {totalPages > 0 && (
          <button
            onClick={() => setShowIndexModal(true)}
            className="self-start sm:self-auto px-3.5 py-2 app-bg-card border app-border font-bold text-xs rounded-xl shadow-xs hover:bg-gray-100 transition flex items-center space-x-1.5 cursor-pointer"
          >
            <span>📜 一覧で見る ({totalPages}件)</span>
          </button>
        )}
      </div>

      {/* 🌟 2. 状態別スマートフィルタータブ (未返信・AI対応済み・承認ナレッジ・すべて) 🌟 */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-gray-100/80 rounded-2xl border border-gray-200/90 text-xs font-bold">
        {/* 🔴 未返信（要対応） */}
        <button
          type="button"
          onClick={() => setFilterTab("unreplied")}
          className={`px-4 py-2 rounded-xl transition flex items-center space-x-1.5 cursor-pointer ${
            filterTab === "unreplied"
              ? "bg-white text-red-700 shadow-xs border border-gray-200"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <span>🔴 要対応 (未返信)</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              unrepliedCount > 0 ? "bg-red-500 text-white animate-pulse" : "bg-gray-200 text-gray-600"
            }`}
          >
            {unrepliedCount}
          </span>
        </button>

        {/* 🟢 AI対応済み */}
        <button
          type="button"
          onClick={() => setFilterTab("ai_answered")}
          className={`px-4 py-2 rounded-xl transition flex items-center space-x-1.5 cursor-pointer ${
            filterTab === "ai_answered"
              ? "bg-white text-emerald-800 shadow-xs border border-gray-200"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <span>🟢 回答・対応済み</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800">
            {journals.length - unrepliedCount}
          </span>
        </button>

        {/* 🌟 承認ナレッジ */}
        <button
          type="button"
          onClick={() => setFilterTab("approved")}
          className={`px-4 py-2 rounded-xl transition flex items-center space-x-1.5 cursor-pointer ${
            filterTab === "approved"
              ? "bg-white text-amber-900 shadow-xs border border-gray-200"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <span>🌟 AI承認ナレッジ</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-900">
            {approvedCount}
          </span>
        </button>

        {/* 📜 すべて */}
        <button
          type="button"
          onClick={() => setFilterTab("all")}
          className={`px-4 py-2 rounded-xl transition flex items-center space-x-1.5 cursor-pointer ${
            filterTab === "all"
              ? "bg-white text-gray-900 shadow-xs border border-gray-200"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <span>📜 すべて ({journals.length})</span>
        </button>
      </div>

      {/* 🌟 3. 生徒ドロップダウン ＆ キーワード検索バー 🌟 */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
        {/* 生徒選択ドロップダウン */}
        <div className="sm:col-span-4 flex items-center space-x-2">
          <span className="text-xs font-black text-gray-500 shrink-0">👤 生徒:</span>
          <select
            value={selectedStudentFilter}
            onChange={(e) => setSelectedStudentFilter(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
          >
            <option value="all">全生徒 ({studentList.length}名)</option>
            {studentList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* キーワード検索入力 */}
        <div className="sm:col-span-8 flex items-center space-x-2">
          <span className="text-xs font-black text-gray-500 shrink-0">🔍 検索:</span>
          <input
            type="text"
            placeholder="質問内容・キーワード (例: トマト, 虫, 水やり)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 transition placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-gray-400 hover:text-gray-600 font-bold px-2 py-1"
            >
              クリア
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-gray-500">交換日記帳を開いています...</div>
      ) : totalPages === 0 ? (
        /* 該当する日記が0件のときのスマート空状態 */
        <div className="app-bg-card rounded-3xl p-12 text-center border app-border space-y-3">
          <div className="w-12 h-12 app-accent-light rounded-2xl flex items-center justify-center mx-auto text-xl font-bold">
            {filterTab === "unreplied" ? "🎉" : "📖"}
          </div>
          <h3 className="font-bold text-gray-800 text-sm">
            {filterTab === "unreplied"
              ? "現在、未返信の日記・相談はありません！"
              : filterTab === "approved"
              ? "承認済みのAIナレッジはまだありません"
              : "条件に一致する交換日記は見つかりませんでした"}
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {filterTab === "unreplied"
              ? "生徒からの質問にはすべて回答済みです。お疲れ様でした✨"
              : "上部のフィルター条件や検索キーワードを変更してお試しください。"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 4. ページナビゲーションコントローラー (めくり操作) */}
          <div className="flex items-center justify-between app-bg-card p-3 rounded-2xl border app-border shadow-xs">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 0}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1 ${
                currentPage === 0
                  ? "opacity-30 cursor-not-allowed bg-gray-100 text-gray-400"
                  : "app-accent-btn shadow-xs active:scale-95 cursor-pointer"
              }`}
            >
              <span>◀ 前の日記</span>
            </button>

            <div className="text-center space-y-0.5">
              <span className="text-xs font-black text-gray-900">
                表示中: {currentPage + 1} / {totalPages} 件
              </span>
              <div className="flex justify-center space-x-1 max-w-[200px] overflow-hidden">
                {filteredJournals.slice(0, 15).map((_, idx) => (
                  <span
                    key={idx}
                    onClick={() => setCurrentPage(idx)}
                    className={`w-2 h-2 rounded-full cursor-pointer transition ${
                      idx === currentPage ? "app-accent-btn scale-125" : "bg-gray-200 hover:bg-gray-400"
                    }`}
                  ></span>
                ))}
              </div>
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages - 1}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1 ${
                currentPage === totalPages - 1
                  ? "opacity-30 cursor-not-allowed bg-gray-100 text-gray-400"
                  : "app-accent-btn shadow-xs active:scale-95 cursor-pointer"
              }`}
            >
              <span>次の日記 ▶</span>
            </button>
          </div>

          {/* 5. 日記帳スタイル メインカード (めくり表示) */}
          {currentJournal && (
            <div className="app-bg-card rounded-3xl p-8 border-2 app-border shadow-xl space-y-6 relative overflow-hidden transition-all duration-300">
              {/* 日記本風ブック装飾 */}
              <div className="absolute left-0 top-0 bottom-0 w-3 bg-[#e0ded8] border-r border-gray-300"></div>

              <div className="pl-3 space-y-5">
                {/* ヘッダー情報 */}
                <div className="flex flex-wrap items-center justify-between border-b border-gray-200 pb-4 gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-full app-accent-btn font-black flex items-center justify-center text-sm shadow-md">
                      {currentJournal.studentAvatar}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-1">
                        <h3 className="font-extrabold text-gray-900 text-base">{currentJournal.studentName}</h3>
                        <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {currentJournal.taskTitle}
                        </span>
                        {/* 🚨 緊急度・要注意キーワードバッジ */}
                        {isUrgentJournal(currentJournal.content) && (
                          <span className="text-[10px] font-black bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                            <span>🚨</span>
                            <span>要確認 (病害虫・枯れ等の相談)</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 font-semibold mt-0.5">
                        📅 記載日時: {currentJournal.created_at}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleApprove(currentJournal.id, currentJournal.is_approved)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer ${
                        currentJournal.is_approved
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      <span>{currentJournal.is_approved ? "★ AIナレッジ承認済み" : "☆ AI知識として承認"}</span>
                    </button>

                    <button
                      onClick={(e) => handleDeleteJournal(currentJournal.id, e)}
                      title="この日記・相談データを削除"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition font-bold text-xs flex items-center justify-center border border-gray-200 hover:border-red-200 cursor-pointer"
                    >
                      <span>🗑️ 削除</span>
                    </button>
                  </div>
                </div>

                {/* 生徒の日誌・質問本文 */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-extrabold text-gray-500 block">📝 生徒からの提出・質問ノート:</span>
                  <div className="text-sm text-gray-800 leading-relaxed bg-amber-50/40 p-5 rounded-2xl border border-amber-100 shadow-inner font-medium whitespace-pre-wrap">
                    {currentJournal.content}
                  </div>
                </div>

                {/* 講師からの回答・返信＆編集エリア (返信と同時にナレッジ承認も可能) */}
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm app-text-main flex items-center space-x-1.5">
                      <span>💬 講師からのアドバイス・回答</span>
                    </h4>

                    {currentJournal.reply && editingReplyId !== currentJournal.id && (
                      <button
                        onClick={() => handleStartEditReply(currentJournal)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer"
                      >
                        <span>✏️ 回答を編集する</span>
                      </button>
                    )}
                  </div>

                  {currentJournal.reply && editingReplyId !== currentJournal.id ? (
                    <div className="app-accent-light p-4 rounded-2xl text-xs space-y-1.5 border app-border shadow-xs">
                      <p className="text-gray-900 leading-relaxed font-medium text-sm whitespace-pre-wrap">
                        {currentJournal.reply}
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-emerald-100 text-[10px] text-gray-500">
                        <span>
                          {currentJournal.is_approved ? "🌟 農園AIナレッジとして参照中" : "💡 未承認（通常返信）"}
                        </span>
                        <span className="font-semibold">✓ 返信完了</span>
                      </div>
                    </div>
                  ) : (
                    /* 返信入力 ＆ 再編集フォーム */
                    <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                      <textarea
                        rows={3}
                        placeholder="回答や個別アドバイスを入力してください..."
                        value={replyInput[currentJournal.id] || ""}
                        onChange={(e) =>
                          setReplyInput({ ...replyInput, [currentJournal.id]: e.target.value })
                        }
                        className="w-full p-3 rounded-xl text-xs focus:outline-none transition resize-none font-medium bg-white border border-gray-200 focus:ring-2 focus:ring-emerald-600"
                      />

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        {/* ★ 返信と同時にAIナレッジとして承認するチェックボックス */}
                        <label className="flex items-center space-x-2 text-xs font-bold text-amber-900 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={approveOnReply[currentJournal.id] || false}
                            onChange={(e) =>
                              setApproveOnReply({
                                ...approveOnReply,
                                [currentJournal.id]: e.target.checked,
                              })
                            }
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>🌟 この回答を農園AIナレッジとしても登録（承認）する</span>
                        </label>

                        <div className="flex justify-end space-x-2">
                          {editingReplyId === currentJournal.id && (
                            <button
                              type="button"
                              onClick={() => setEditingReplyId(null)}
                              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                              キャンセル
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSendReply(currentJournal.id)}
                            className="px-5 py-2.5 app-accent-btn font-bold text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer"
                          >
                            {editingReplyId === currentJournal.id ? "回答を更新保存する" : "回答を送信する"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🌟 6. 下部: 生徒からの「作業記録の報告」自動流動スライドカード 🌟 */}
      <div className="pt-6 border-t border-emerald-100/60 space-y-3">
        <div className="flex flex-wrap items-center justify-between px-1 gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-base">🌾</span>
            <h3 className="font-black text-gray-900 text-sm">受講生の最新作業・観察記録</h3>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              クリックで対象の畑へジャンプ 📍
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowSlideSettingsModal(true)}
              className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-950 border border-emerald-300 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span>⚙️ スライド設定</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                {slideSettings.sortBy === "newest"
                  ? "最新順"
                  : slideSettings.sortBy === "studentName"
                  ? "生徒順"
                  : slideSettings.sortBy === "hasImage"
                  ? "写真優先"
                  : slideSettings.sortBy === "hasHarvest"
                  ? "収穫優先"
                  : slideSettings.sortBy === "isQuestion"
                  ? "質問優先"
                  : "古い順"}
                {slideSettings.limitPerStudent > 0 ? ` (各生徒${slideSettings.limitPerStudent}件)` : " (全件)"}
              </span>
            </button>

            <div className="hidden sm:flex items-center space-x-2 text-[11px] font-bold">
              {activeSlideStatus === "reverse" && (
                <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full animate-pulse flex items-center space-x-1">
                  <span>◀◀</span>
                  <span>逆スライド中</span>
                </span>
              )}
              {activeSlideStatus === "paused" && (
                <span className="text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full flex items-center space-x-1">
                  <span>⏸</span>
                  <span>一時停止中</span>
                </span>
              )}
              {activeSlideStatus === "forward" && (
                <span className="text-gray-400 font-medium">
                  💡 ホバーで停止 / 左端で逆再生
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2行まとめて流れる無限オートスライダーコンテナ */}
        <div
          ref={sliderRef}
          onMouseMove={handleSliderMouseMove}
          onMouseLeave={handleSliderMouseLeave}
          className="relative w-full overflow-x-hidden rounded-2xl bg-emerald-50/30 p-3 border border-emerald-100/80 select-none cursor-pointer"
        >
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-emerald-100/40 to-transparent pointer-events-none z-10 flex items-center justify-start pl-1">
            <span className="text-emerald-700/40 text-xs font-black">◀</span>
          </div>

          <div ref={trackRef} className="flex space-x-3 w-max">
            {[...slideColumns, ...slideColumns].map((col, colIdx) => (
              <div key={`col_${colIdx}`} className="flex flex-col space-y-2.5 shrink-0">
                {col.map((item, rowIdx) => {
                  const hasRealImage =
                    item.imageUrl &&
                    item.imageUrl.trim() &&
                    item.imageUrl !== "undefined" &&
                    !item.imageUrl.includes("undefined");

                  return (
                    <div
                      key={`rec_${item.id}_${colIdx}_${rowIdx}`}
                      onClick={() => {
                        if (onNavigateToFarm) {
                          onNavigateToFarm(item.plotCode, item.farmId);
                        } else {
                          setToastMessage(`📍 畑管理画面を開きます (${item.studentName})`);
                          setShowToast(true);
                        }
                      }}
                      className="w-80 sm:w-96 h-[126px] shrink-0 bg-white p-2.5 rounded-2xl border border-emerald-100/90 shadow-2xs hover:shadow-md hover:border-emerald-400 hover:bg-emerald-50/20 transition-all duration-200 flex space-x-3 group text-left relative overflow-hidden cursor-pointer"
                    >
                      {hasRealImage && (
                        <div className="w-24 sm:w-28 h-full rounded-xl overflow-hidden shrink-0 border border-emerald-200 shadow-2xs bg-emerald-50 relative group-hover:scale-[1.02] transition-transform duration-300">
                          <img
                            src={item.imageUrl}
                            alt="観察写真"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}

                      <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black text-emerald-900 bg-emerald-100/90 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                              <span>📅</span>
                              <span>{item.dateStr}</span>
                              <span className="text-emerald-700 font-semibold">{item.timeStr}</span>
                            </span>

                            <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 truncate max-w-[120px]">
                              {item.title}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1.5">
                            <div className="w-4.5 h-4.5 rounded-full bg-emerald-600 text-white font-black text-[9px] flex items-center justify-center shadow-2xs shrink-0">
                              {item.studentAvatar}
                            </div>
                            <span className="font-extrabold text-gray-900 text-xs truncate max-w-[140px]">
                              {item.studentName}
                            </span>
                          </div>

                          <p className="text-[11px] text-gray-700 font-medium line-clamp-2 leading-snug">
                            {item.content}
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-[9px] text-gray-400 font-semibold border-t border-gray-100 pt-0.5">
                          {item.harvestAmount ? (
                            <span className="font-bold text-amber-800 bg-amber-50 px-1 rounded border border-amber-200">
                              {item.harvestAmount}
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-bold">✓ 記録済み</span>
                          )}

                          <span className="text-emerald-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                            畑を開く ↗
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🌟 7. 日誌インデックスモーダル (フィルター適用後の一覧ジャンプ) 🌟 */}
      {showIndexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="app-bg-card rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto border app-border">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-black text-gray-900 text-sm">
                📜 日記・相談一覧 ({filteredJournals.length}件)
              </h3>
              <button
                onClick={() => setShowIndexModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {filteredJournals.map((j, idx) => (
                <div
                  key={j.id}
                  onClick={() => {
                    setCurrentPage(idx);
                    setShowIndexModal(false);
                  }}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                    idx === currentPage
                      ? "app-accent-light border-green-300 font-bold"
                      : "bg-white hover:bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="space-y-0.5 min-w-0 flex-1 mr-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-1">
                      <span className="font-bold text-gray-900">{j.studentName}</span>
                      {j.reply ? (
                        <span className="text-[9px] bg-green-100 text-green-800 px-1.5 py-0.2 rounded font-bold">
                          回答済み
                        </span>
                      ) : (
                        <span className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.2 rounded font-black animate-pulse">
                          🔴 未回答
                        </span>
                      )}
                      {j.is_approved && (
                        <span className="text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                          🌟 ナレッジ承認
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 line-clamp-1">{j.content}</p>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-[10px] text-gray-400">{j.created_at}</span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteJournal(j.id, e)}
                      title="この日記を削除"
                      className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition cursor-pointer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🌟 スライド表示設定モーダル 🌟 */}
      <SlideSettingsModal
        isOpen={showSlideSettingsModal}
        onClose={() => setShowSlideSettingsModal(false)}
        settings={slideSettings}
        onSaveSettings={handleSaveSlideSettings}
      />
    </div>
  );
}
