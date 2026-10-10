'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFarmManager } from '@/hooks/useFarmManager';
import { GrowthStage, WorkType, CropRecord, FarmBed } from '@/types/farm';
import Toast from '@/components/ui/Toast';
import TaskSlider, { TaskSliderItem } from '@/components/student/TaskSlider';
import BedCompletionModal from '@/components/farm/BedCompletionModal';
import ArchivedCropsModal from '@/components/farm/ArchivedCropsModal';
import { SproutLoader } from '@/components/SproutLoader';
import { supabase } from '@/lib/supabase';
import { formatDate, formatHarvestAmount } from '@/lib/utils/formatHelper';
import { uploadImageToStorage } from '@/lib/storage';
import {
  parseCrops,
  formatBedCropLabel,
  isRecordMatchingCrop,
  mergeCrops,
  getBedAllCrops,
} from '@/lib/farm/companionCropsHelper';

interface StudentFarmRecordViewProps {
  studentId?: string;
  studentName?: string;
  tasks?: TaskSliderItem[];
  onSelectTask?: (task: TaskSliderItem) => void;
  onCompleteTask?: (id: string) => void;
  onUncompleteTask?: (id: string) => void;
  newJournal?: string;
  setNewJournal?: (val: string) => void;
  onAddJournal?: () => void;
}

export default function StudentFarmRecordView({
  studentId,
  studentName = '受講生',
  tasks = [],
  onSelectTask,
  onCompleteTask,
  onUncompleteTask,
  newJournal = '',
  setNewJournal,
  onAddJournal,
}: StudentFarmRecordViewProps) {
  const {
    isLoading,
    plots,
    records,
    addCropRecord,
    updateCropRecord,
    deleteCropRecord,
    completeBedCrop,
    updateBedCrop,
  } = useFarmManager();

  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // 🌟 自分（ログイン中の生徒）に現在割り当てられている担当区画を厳密抽出 🌟
  const myPlot =
    // 1. studentId に完全一致するプロットを最優先
    (studentId ? plots.find((p) => !p.is_vacant && p.student_id === studentId) : null) ||
    // 2. studentName (表示名) に一致するプロット
    (studentName && studentName !== '受講生'
      ? plots.find(
          (p) =>
            !p.is_vacant &&
            p.student_name &&
            (p.student_name === studentName ||
              p.student_name.includes(studentName) ||
              studentName.includes(p.student_name))
        )
      : null) ||
    // 3. 未ログイン/デフォルト時のフォールバック (最初の利用可能プロット)
    plots.find((p) => !p.is_vacant) ||
    plots[0] ||
    null;

  const plotCode = myPlot?.code || 'A1';
  const defaultBedCount = myPlot?.beds && myPlot.beds.length > 0 ? myPlot.beds.length : 7;
  const rawBeds: FarmBed[] =
    myPlot?.beds && myPlot.beds.length > 0
      ? myPlot.beds
      : Array.from({ length: defaultBedCount }, (_, i) => ({
          id: `plot_cell_${plotCode}_bed_${i + 1}`,
          plot_id: `plot_cell_${plotCode}`,
          bed_number: i + 1,
          crop_name: '未確定 🌱',
          is_updated: false,
          status: 'active',
        }));

  // 🌟 1. 稼働中の畝（未アーカイブ）と過去のアーカイブ畝をまず分離 🌟
  const unarchivedBeds = rawBeds.filter((b) => b.status !== 'archived');
  const archivedBeds = rawBeds.filter((b) => b.status === 'archived');

  // 🌟 2. 稼働中ベッドを bed_number 順に整列（講師画面と完全一致） 🌟
  const activeBeds: FarmBed[] = [...unarchivedBeds]
    .sort((a, b) => (Number(a.bed_number) || 0) - (Number(b.bed_number) || 0))
    .map((b, idx) => ({
      ...b,
      id: b.id || `plot_cell_${plotCode}_bed_${b.bed_number || idx + 1}`,
      bed_number: Number(b.bed_number) || idx + 1,
      status: b.status || 'active',
      crop_name: b.crop_name || '未確定 🌱',
    }));

  // 生徒が選択中の対象畝ベッド (初期状態は未選択、クリック時のみ選択。'shared' の場合は全体共有)
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const isSharedSelected = selectedBedId === 'shared';
  const currentBed = isSharedSelected
    ? null
    : activeBeds.find((b) => b.id === selectedBedId) || null;

  // 🌟 #2: 混植畝における作物品種フィルタータブ ('all' または個別品種名) 🌟
  const [selectedCropFilter, setSelectedCropFilter] = useState<string>('all');

  // 全体共有記録の抽出
  const sharedRecords = records.filter(
    (r) =>
      (!r.bed_id || r.bed_id === 'shared' || r.bed_id.endsWith('_shared')) &&
      (!r.plot_id || r.plot_id === myPlot?.id)
  );
  const sharedRecordsCount = sharedRecords.length;

  // 🌟 案B: タイムラインへの自動スムーズスクロール用 Ref & ハンドラー 🌟
  const timelineSectionRef = useRef<HTMLDivElement>(null);

  const scrollToTimeline = useCallback(() => {
    setTimeout(() => {
      if (timelineSectionRef.current) {
        timelineSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  }, []);

  const handleSelectBed = useCallback(
    (bedId: string) => {
      setSelectedCropFilter('all');
      setSelectedBedId((prev) => {
        const next = prev === bedId ? null : bedId;
        if (next !== null) {
          scrollToTimeline();
        }
        return next;
      });
    },
    [scrollToTimeline]
  );

  const handleSelectShared = useCallback(() => {
    setSelectedCropFilter('all');
    setSelectedBedId((prev) => {
      const next = prev === 'shared' ? null : 'shared';
      if (next !== null) {
        scrollToTimeline();
      }
      return next;
    });
  }, [scrollToTimeline]);

  const [showInputModal, setShowInputModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CropRecord | null>(null);

  const [customCropName, setCustomCropName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmittingRecord, setIsSubmittingRecord] = useState(false);

  const [selectedStage, setSelectedStage] = useState<GrowthStage>('果実肥大');
  const [heightCm, setHeightCm] = useState<number>(75);
  const [selectedWorks, setSelectedWorks] = useState<WorkType[]>(['水やり', '追肥']);
  const [notes, setNotes] = useState('');
  const [harvestAmount, setHarvestAmount] = useState('');

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const STAGES: GrowthStage[] = [
    '播種・苗植え',
    '発芽・活着',
    '本葉展開・つる伸び',
    '開花・受粉',
    '果実肥大',
    '収穫期',
  ];

  const WORKS: WorkType[] = [
    '水やり',
    '追肥',
    'わき芽かき・仕立て',
    '除草・土寄せ',
    '病害虫対策',
    '収穫',
  ];

  const handleToggleWork = (w: WorkType) => {
    if (selectedWorks.includes(w)) {
      setSelectedWorks(selectedWorks.filter((item) => item !== w));
    } else {
      setSelectedWorks([...selectedWorks, w]);
    }
  };

  // 画像ファイルを自動リサイズ＆圧縮（スマホ写真やスクショを超軽量JPEG変換）
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const rawResult = readerEvent.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // 🌟 画像をカード・一覧表示に最適なサイズ（最大480px / 品質0.5）に自動圧縮し転送量を最小化 🌟
        const maxDim = 480;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.5);
          setImageUrl(compressed);
        } else {
          setImageUrl(rawResult);
        }
        setToastMessage('📸 写真・画像を最適化して添付しました！');
        setShowToast(true);
      };
      img.src = rawResult;
    };
    reader.readAsDataURL(file);
  };

  // 画像ファイル選択ハンドラー
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // 🌟 クリップボード貼り付け (Ctrl+V / Paste) ハンドラー 🌟
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processImageFile(file);
          break;
        }
      }
    }
  };

  // 新規または編集の保存
  const handleSubmitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const isTargetShared = selectedBedId === 'shared';
    if ((!currentBed && !isTargetShared) || isSubmittingRecord) return;

    setIsSubmittingRecord(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageUrl && imageUrl.startsWith('data:')) {
        finalImageUrl = await uploadImageToStorage(imageUrl, 'records');
        if (!finalImageUrl) {
          alert('画像のアップロードに失敗しました。通信環境を確認して再度お試しください。');
          setIsSubmittingRecord(false);
          return;
        }
      }

      // 🌟 生徒が入力した品種名 (未入力時は既存品種を引き継ぐ) 🌟
      const enteredCrop = customCropName.trim();
      const existingCrop =
        !isTargetShared && currentBed?.crop_name && currentBed.crop_name !== '未確定 🌱'
          ? currentBed.crop_name
          : '';

      // 🌟 混植マージ: 既存の畝名と過去の記録、および新入力を合体して品種消失を完全防止 🌟
      const allKnownBedCrops = !isTargetShared
        ? getBedAllCrops(existingCrop, currentBedRecords)
        : [];
      const baseCropString = allKnownBedCrops.join('、');

      const bedCropToSave = isTargetShared
        ? '全体共通'
        : mergeCrops(baseCropString || existingCrop, enteredCrop);

      const finalCrop = enteredCrop || existingCrop || (isTargetShared ? '全体共通' : '未確定 🌱');
      const cleanNotes = notes
        .replace(/\[IMG:[\s\S]+?\]/g, '')
        .replace(/【.*?】/g, '')
        .trim();
      const taggedNotes = finalCrop !== '未確定 🌱' ? `【${finalCrop}】${cleanNotes}` : cleanNotes;

      // 1. Supabase farm_beds の作物品種名を更新 (畝選択時のみ)
      if (!isTargetShared && currentBed) {
        try {
          if (updateBedCrop) {
            await updateBedCrop(currentBed.id, bedCropToSave);
          } else {
            await supabase
              .from('farm_beds')
              .update({ crop_name: bedCropToSave })
              .eq('id', currentBed.id);
          }
        } catch (e) {
          console.warn('farm_beds crop update notice:', e);
        }
      }

      if (editingRecord) {
        const targetBedId = isTargetShared
          ? null
          : selectedBedId && selectedBedId !== 'shared'
            ? selectedBedId
            : currentBed?.id || null;
        updateCropRecord(editingRecord.id, {
          bed_id: targetBedId,
          plot_id: myPlot?.id || null,
          crop_name: finalCrop,
          growth_stage: selectedStage,
          height_cm: isTargetShared ? undefined : Number(heightCm),
          work_types: selectedWorks,
          notes: taggedNotes,
          harvest_amount: harvestAmount.trim() || undefined,
          image_url: finalImageUrl || undefined,
        });
        setToastMessage('✏️ 過去の観察記録を更新しました！');
      } else {
        const todayStr = new Date().toLocaleDateString('ja-JP');
        addCropRecord(isTargetShared ? 'shared' : currentBed!.id, {
          bed_id: isTargetShared ? null : currentBed!.id,
          plot_id: myPlot?.id || null,
          date: todayStr,
          crop_name: finalCrop,
          growth_stage: selectedStage,
          height_cm: isTargetShared ? undefined : Number(heightCm),
          work_types: selectedWorks,
          notes: taggedNotes,
          harvest_amount: harvestAmount.trim() || undefined,
          image_url: finalImageUrl || undefined,
        });

        // 講師の相談日誌・スライドカード用に journals へも自動連動保存
        try {
          const resolvedStudentId =
            studentId ||
            (!isTargetShared && (currentBed as { student_id?: string })?.student_id) ||
            myPlot?.student_id ||
            null;

          const hasHttpImg = finalImageUrl && finalImageUrl.startsWith('http');
          const headerTag = isTargetShared
            ? '【区画全体・共通】'
            : `【畝 ${currentBed!.bed_number} (${finalCrop})】`;
          const journalContent =
            finalImageUrl && !hasHttpImg
              ? `${headerTag}${cleanNotes}\n[IMG:${finalImageUrl}]`
              : `${headerTag}${cleanNotes}`;

          const { error: jErr } = await supabase.from('journals').insert([
            {
              student_id: resolvedStudentId,
              content: journalContent,
              image_url: hasHttpImg ? finalImageUrl : null,
              role: 'student',
            },
          ]);
          if (jErr) {
            console.warn('journals insert warning:', jErr);
          }
        } catch (e) {
          console.error('journals insert error:', e);
        }

        setToastMessage(
          isTargetShared
            ? '🎉 共通の作業として記録を登録しました！'
            : `🎉 畝 ${currentBed!.bed_number} (${finalCrop}) に新しい記録を登録しました！`
        );
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('nouato_sync_event'));
      }

      setShowInputModal(false);
      setEditingRecord(null);
      setNotes('');
      setCustomCropName('');
      setImageUrl('');
      setHarvestAmount('');
      setShowToast(true);
    } catch (err) {
      console.error('handleSubmitRecord error:', err);
    } finally {
      setIsSubmittingRecord(false);
    }
  };

  // 🌟 編集モーダルを開く 🌟
  const handleOpenEditModal = (rec: CropRecord) => {
    setEditingRecord(rec);
    const initialBedId = rec.bed_id ? rec.bed_id : 'shared';
    setSelectedBedId(initialBedId);
    setSelectedStage((rec.growth_stage as GrowthStage) || '果実肥大');
    setHeightCm(rec.height_cm || 75);
    setSelectedWorks(rec.work_types || ['水やり']);
    const tagCrop = rec.notes?.match(/【(.*?)】/)?.[1] || '';
    const matchingBed = activeBeds.find((b) => b.id === rec.bed_id);
    const defaultBedCrop =
      matchingBed?.crop_name && matchingBed.crop_name !== '未確定 🌱' ? matchingBed.crop_name : '';
    setCustomCropName(
      tagCrop || rec.crop_name || defaultBedCrop || (initialBedId === 'shared' ? '全体共通' : '')
    );
    setNotes(
      (rec.notes || '')
        .replace(/【.*?】/g, '')
        .replace(/\[IMG:[\s\S]+?\]/g, '')
        .trim()
    );
    setHarvestAmount(rec.harvest_amount || '');
    setShowInputModal(true);
  };

  // 🌟【要件3】過去の記録の削除 🗑️ 🌟
  const handleDeleteRecord = (recId: string) => {
    if (confirm('この過去の観察記録を削除してもよろしいですか？')) {
      deleteCropRecord(recId);
      setToastMessage('🗑️ 過去の観察記録を削除しました');
      setShowToast(true);
    }
  };

  // 生徒の日誌・返信データ (journals) の取得とリアルタイム同期
  const [studentJournals, setStudentJournals] = useState<Array<Record<string, unknown>>>([]);

  const fetchStudentJournals = useCallback(async () => {
    const targetStudentId = studentId || myPlot?.student_id;
    if (!targetStudentId) return;

    try {
      const { data, error } = await supabase
        .from('journals')
        .select('*')
        .eq('student_id', targetStudentId)
        .order('created_at', { ascending: false });

      if (data && !error) {
        setStudentJournals(data);
      }
    } catch (err) {
      console.warn('fetchStudentJournals error:', err);
    }
  }, [studentId, myPlot?.student_id]);

  useEffect(() => {
    fetchStudentJournals();

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('nouato_farm_sync_channel');
      bc.onmessage = () => {
        fetchStudentJournals();
      };
    } catch (e) {}

    const handleSync = () => {
      fetchStudentJournals();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('nouato_sync_event', handleSync);
    }

    return () => {
      if (bc) bc.close();
      if (typeof window !== 'undefined') {
        window.removeEventListener('nouato_sync_event', handleSync);
      }
    };
  }, [fetchStudentJournals]);

  // 選択した畝(ベッド)の時系列記録 (該当区画および選択した畝、または全体共有に厳密絞り込み)
  const currentBedRecords = isSharedSelected
    ? sharedRecords.sort(
        (a, b) =>
          new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
      )
    : currentBed
      ? records
          .filter((r) => r.bed_id === currentBed.id)
          .sort(
            (a, b) =>
              new Date(b.created_at || b.date).getTime() -
              new Date(a.created_at || a.date).getTime()
          )
      : [];

  // 観察記録 (cropRecords) と 講師からの返信 (journals) を合成したタイムラインリスト
  type ObservationTimelineItem = {
    id: string;
    type: 'observation';
    timestamp: number;
    record: CropRecord;
  };

  type TeacherReplyTimelineItem = {
    id: string;
    type: 'teacher_reply';
    timestamp: number;
    dateStr: string;
    teacherName: string;
    replyContent: string;
    originalQuestion?: string;
  };

  type CombinedTimelineItem = ObservationTimelineItem | TeacherReplyTimelineItem;

  const bedNumberStr = currentBed ? String(currentBed.bed_number) : '';

  const synthesizedTimelineItems = (() => {
    if (!currentBed && !isSharedSelected) return [];

    const observationItems: CombinedTimelineItem[] = currentBedRecords.map((rec) => ({
      id: `rec_${rec.id}`,
      type: 'observation',
      timestamp: new Date(rec.created_at || rec.date).getTime(),
      record: rec,
    }));

    const replyItems: TeacherReplyTimelineItem[] = [];
    const seenReplyTexts = new Set<string>();

    studentJournals.forEach((j) => {
      const content = String(j.content || j.text || '');
      const replyText = String(j.reply || '').trim();

      const isExplicitShared =
        content.includes('【区画全体】') ||
        content.includes('【共通】') ||
        content.includes('【全体共通】') ||
        content.includes('【全体共有】');

      if (isSharedSelected) {
        // 共通の場合: 特定畝タグがあるものは除外
        const bedTagMatch = content.match(/【畝\s*([0-9]+)/) || content.match(/畝\s*([0-9]+)/);
        if (bedTagMatch) {
          return;
        }

        // 明示的な共通タグがない場合で、現在栽培中の特定作物への言及がある場合は、その畝の相談なので「共通」から除外
        if (!isExplicitShared) {
          const isMentioningSpecificBedCrop = activeBeds.some((b) => {
            const crop = b.crop_name?.replace(/🌱/g, '').trim();
            return crop && crop !== '未確定' && content.includes(crop);
          });
          if (isMentioningSpecificBedCrop) {
            return;
          }
        }
      } else if (currentBed) {
        // 送信元の畝・作物の厳密一致判定
        const bedTagMatch = content.match(/【畝\s*([0-9]+)/) || content.match(/畝\s*([0-9]+)/);
        if (bedTagMatch) {
          const taggedBedNum = bedTagMatch[1];
          if (taggedBedNum !== bedNumberStr) {
            return;
          }
        } else {
          // 畝番号タグがない場合、明示的な共通タグがあるものは除外
          if (isExplicitShared) {
            return;
          }

          // 現在選択されている畝の作物品種名で厳密判定
          const currentCrop = currentBed.crop_name
            ? currentBed.crop_name.replace(/🌱/g, '').trim()
            : '';
          const isValidCurrentCrop = Boolean(currentCrop && currentCrop !== '未確定');

          let isCropMatched = false;
          if (isValidCurrentCrop) {
            if (content.includes(currentCrop)) {
              isCropMatched = true;
            } else {
              const bracketMatches = Array.from(content.matchAll(/【([^】]+)】/g)).map((m) =>
                m[1].trim()
              );
              for (const tag of bracketMatches) {
                if (tag && (currentCrop.includes(tag) || tag.includes(currentCrop))) {
                  isCropMatched = true;
                  break;
                }
              }
            }
          }

          if (!isCropMatched) {
            return;
          }
        }
      }

      if (replyText && replyText !== '講師からの返信') {
        if (!seenReplyTexts.has(replyText)) {
          seenReplyTexts.add(replyText);
          const dateObj = j.updated_at
            ? new Date(String(j.updated_at))
            : j.created_at
              ? new Date(String(j.created_at))
              : new Date();
          const timeStr = dateObj.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          });
          replyItems.push({
            id: `reply_${j.id}`,
            type: 'teacher_reply',
            timestamp: dateObj.getTime(),
            dateStr: `${formatDate(dateObj.toISOString())} ${timeStr}`,
            teacherName: '講師',
            replyContent: replyText,
            originalQuestion: content,
          });
        }
      } else if (
        j.role === 'broadcast' &&
        (j.text === '【返信】講師から相談への回答が届きました' || j.reply === '講師からの返信')
      ) {
        const bContent = String(j.content || '').trim();
        if (bContent && !seenReplyTexts.has(bContent)) {
          seenReplyTexts.add(bContent);
          const dateObj = j.created_at ? new Date(String(j.created_at)) : new Date();
          const timeStr = dateObj.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          });
          replyItems.push({
            id: `reply_bc_${j.id}`,
            type: 'teacher_reply',
            timestamp: dateObj.getTime(),
            dateStr: `${formatDate(dateObj.toISOString())} ${timeStr}`,
            teacherName: '講師',
            replyContent: bContent,
          });
        }
      }
    });

    return [...observationItems, ...replyItems].sort((a, b) => b.timestamp - a.timestamp);
  })();

  // 🌟 #2: 混植畝の登録品種一覧: 畝の登録名および記録ログから全品種を動的に収集 🌟
  const currentBedCrops = getBedAllCrops(currentBed?.crop_name, currentBedRecords);

  // 🌟 自己修復: 混植データが存在するのに畝名が過去に上書きされていた場合、自動でDBを修復同期 🌟
  useEffect(() => {
    if (!currentBed || !currentBed.id || currentBedCrops.length <= 1) return;
    const combinedCrops = currentBedCrops.join('、');
    if (currentBed.crop_name !== combinedCrops) {
      if (updateBedCrop) {
        updateBedCrop(currentBed.id, combinedCrops);
      } else {
        supabase
          .from('farm_beds')
          .update({ crop_name: combinedCrops })
          .eq('id', currentBed.id)
          .then();
      }
    }
  }, [currentBed?.id, currentBed?.crop_name, currentBedCrops, updateBedCrop]);

  const filteredTimelineItems = synthesizedTimelineItems.filter((item) => {
    if (selectedCropFilter === 'all') return true;
    if (item.type === 'observation') {
      return isRecordMatchingCrop(item.record.crop_name, item.record.notes, selectedCropFilter);
    }
    if (item.type === 'teacher_reply') {
      return (
        (item.originalQuestion && item.originalQuestion.includes(selectedCropFilter)) ||
        (item.replyContent && item.replyContent.includes(selectedCropFilter))
      );
    }
    return true;
  });

  if (isLoading || plots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[380px] py-16 animate-fade-in">
        <SproutLoader size={72} />
      </div>
    );
  }

  if (!myPlot) {
    return (
      <div className="space-y-5 animate-fade-in text-gray-800">
        <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

        {/* タスクスライダー */}
        {tasks && tasks.length > 0 && (
          <TaskSlider
            tasks={tasks}
            onSelect={onSelectTask || (() => {})}
            onComplete={onCompleteTask || (() => {})}
            onUncomplete={onUncompleteTask}
          />
        )}

        <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-xs text-center space-y-3">
          <span className="text-4xl">🧑‍🌾</span>
          <h3 className="font-black text-gray-900 text-base">
            担当の畑区画はまだ割り当てられていません
          </h3>
          <p className="text-xs text-gray-500 font-bold max-w-sm mx-auto leading-relaxed">
            講師が「畑管理」画面であなたのアカウントに区画を割り当てると、ここに区画とベッドが表示され、観察日記や成長記録を保存できるようになります。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* 🌟 1. 上部: 進行中のタスク (TaskSlider) 🌟 */}
      {tasks && tasks.length > 0 && (
        <TaskSlider
          tasks={tasks}
          onSelect={onSelectTask || (() => {})}
          onComplete={onCompleteTask || (() => {})}
          onUncomplete={onUncompleteTask}
        />
      )}

      {/* 🌟 2. 担当区画内の畝(ベッド)一覧 (案B: 全体共有の明確化 & タップ時自動スクロール) 🌟 */}
      <div className="bg-white p-3.5 sm:p-5 rounded-3xl border border-gray-200 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between border-b pb-2 gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-gray-900 text-xs sm:text-sm flex items-center gap-1.5">
              <span>🌱 {myPlot.name} の畝一覧</span>
              <span className="text-[11px] font-bold text-gray-400">
                ({activeBeds.length}畝 栽培中)
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 📦 過去の作物を見るボタン */}
            <button
              type="button"
              onClick={() => setShowArchiveModal(true)}
              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <span>📦 過去の作物を見る</span>
              <span className="bg-emerald-800 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {archivedBeds.length}
              </span>
            </button>

            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {isSharedSelected
                ? '🌐 共通 選択中'
                : currentBed
                  ? `畝 ${currentBed.bed_number} 選択中`
                  : 'タップして記録を表示'}
            </span>
          </div>
        </div>

        {/* 🌐 共通切り替えバー */}
        <button
          type="button"
          onClick={handleSelectShared}
          className={`w-full py-2.5 px-3.5 rounded-2xl border-2 transition font-black text-xs flex items-center justify-between cursor-pointer ${
            isSharedSelected
              ? 'bg-emerald-700 text-white border-emerald-800 ring-4 ring-amber-400 shadow-md scale-[1.01]'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base shrink-0">🌐</span>
            <span className="font-black text-xs leading-none">共通</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                isSharedSelected ? 'bg-white text-emerald-900' : 'bg-emerald-800 text-white'
              }`}
            >
              全 {sharedRecordsCount} 件
            </span>
            {isSharedSelected && (
              <span className="text-amber-300 text-xs font-black">✓ 表示中</span>
            )}
          </div>
        </button>

        {activeBeds.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <span className="text-3xl">🌾</span>
            <p className="text-xs font-black text-gray-600">現在栽培中の畝はありません</p>
            <p className="text-[11px] text-gray-400 font-bold">
              すべての作物の収穫が完了しました。講師が新しい畝を用意するとここに表示されます。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {activeBeds.map((bed) => {
              const isSelected = selectedBedId === bed.id;
              const isPending = bed.status === 'completed_pending';

              // 生徒の観察記録・投稿画像のサムネイル検索
              const bedRecs = records.filter((r) => r.bed_id === bed.id);
              const latestImg = bedRecs.find((r) => r.image_url || r.photo_url)?.image_url || null;

              // 成長段階・進捗率 (0〜100%) に応じた色の濃淡カラーマップ
              const progress = (bed as { progress_percent?: number }).progress_percent || 0;
              let colorClasses =
                'bg-emerald-50/90 text-emerald-900 border-emerald-200 hover:bg-emerald-100';

              if (isPending) {
                colorClasses =
                  'bg-gradient-to-br from-amber-100 to-orange-100 text-amber-950 border-amber-400 ring-2 ring-amber-400 shadow-xs';
              } else if (progress >= 80) {
                colorClasses =
                  'bg-gradient-to-br from-emerald-800 to-teal-950 text-amber-300 border-emerald-900 shadow-sm';
              } else if (progress >= 50) {
                colorClasses =
                  'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-xs';
              } else if (progress >= 25) {
                colorClasses =
                  'bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200';
              }

              return (
                <button
                  key={bed.id || `bed_${bed.bed_number}`}
                  type="button"
                  onClick={() => handleSelectBed(bed.id)}
                  className={`relative py-2 px-2.5 rounded-2xl border-2 transition font-black text-xs text-center flex flex-col items-center justify-center space-y-0.5 overflow-hidden cursor-pointer ${colorClasses} ${
                    isSelected
                      ? 'ring-4 ring-amber-400 border-amber-400 scale-105 shadow-md z-10'
                      : 'opacity-90 hover:opacity-100 hover:scale-[1.02]'
                  }`}
                >
                  {/* 投稿画像プレビューサムネイル */}
                  {latestImg && (
                    <div className="w-full h-5 rounded-md overflow-hidden mb-0.5 border border-white/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={latestImg} alt="投稿写真" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <span className="text-xs font-black leading-tight flex items-center gap-1">
                    <span>畝 {bed.bed_number}</span>
                    {isSelected && <span className="text-amber-400 text-[10px]">✓</span>}
                  </span>
                  {(() => {
                    const bedAllCrops = getBedAllCrops(bed.crop_name, bedRecs);
                    const bedCropLabel =
                      bedAllCrops.length > 0 ? bedAllCrops.join('、') : bed.crop_name;
                    return (
                      <span className="text-[10.5px] opacity-80 font-bold max-w-[85px] truncate leading-tight">
                        {formatBedCropLabel(bedCropLabel)}
                      </span>
                    );
                  })()}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 🌟 3. 畝をクリックしたときだけ表示される記録セクション 🌟 */}
      {/* 🌟 講師からの差し戻し通知バナー 🌟 */}
      {activeBeds.some((b) => b.status === 'rejected') && (
        <div className="bg-rose-50 border-2 border-red-400 p-4 rounded-3xl shadow-sm text-xs text-red-950 space-y-2 animate-bounce-short">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <h4 className="font-black text-sm text-red-900">
              収穫完了報告が講師より差し戻されました
            </h4>
          </div>
          {activeBeds
            .filter((b) => b.status === 'rejected')
            .map((rb) => (
              <div
                key={rb.id}
                className="bg-white/90 p-3 rounded-2xl border border-red-200 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <span className="font-black text-red-900 mr-2">
                    【畝 #{rb.bed_number} ({rb.crop_name})】
                  </span>
                  <span className="text-gray-700 font-bold">
                    理由: {rb.reject_reason || rb.completion_notes || '内容の再確認をお願いします'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBedId(rb.id);
                    setShowCompletionModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-xs shadow-xs cursor-pointer"
                >
                  📝 内容を修正して再提出
                </button>
              </div>
            ))}
        </div>
      )}

      {currentBed || isSharedSelected ? (
        <div
          ref={timelineSectionRef}
          className="bg-white p-4 sm:p-5 rounded-3xl border-2 border-emerald-500/50 shadow-xs space-y-4 animate-fade-in scroll-mt-3"
        >
          <div className="flex flex-wrap items-center justify-between border-b pb-3 gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-gray-900 text-sm sm:text-base">
                  {isSharedSelected
                    ? '🌐 共通の記録'
                    : `📅 畝 ${currentBed?.bed_number} ${currentBedCrops.length > 0 ? `(${currentBedCrops.join('、')})` : ''} の記録`}
                </h3>
                <span className="text-xs text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full font-bold">
                  全 {currentBedRecords.length} 件
                </span>
                {!isSharedSelected && currentBed?.status === 'completed_pending' && (
                  <span className="text-xs text-amber-900 bg-amber-200 px-2.5 py-0.5 rounded-full font-black animate-pulse">
                    ⏳ 収穫完了・講師確認待ち (記録ロック中)
                  </span>
                )}
                {!isSharedSelected && currentBed?.status === 'rejected' && (
                  <span className="text-xs text-red-900 bg-red-200 px-2.5 py-0.5 rounded-full font-black animate-pulse">
                    ⚠️ 差し戻し（要再提出）
                  </span>
                )}
              </div>
              {(isSharedSelected || currentBed?.status === 'completed_pending') && (
                <p className="text-[11px] text-gray-400 font-bold mt-0.5">
                  {isSharedSelected
                    ? '※ 区画全体や農園共通の作業・タスク完了のタイムラインです'
                    : '※ 講師の確認待ちのため、この畝の記録は閲覧専用（編集・新規追加不可）となります'}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* 🏆 収穫完了報告ボタン (畝選択時のみ) */}
              {!isSharedSelected && currentBed && currentBed.status !== 'completed_pending' && (
                <button
                  type="button"
                  onClick={() => setShowCompletionModal(true)}
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white font-black text-xs rounded-xl shadow-xs transition transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🏆 収穫完了を報告</span>
                </button>
              )}

              {!isSharedSelected && currentBed?.status === 'completed_pending' ? (
                <div className="px-3 py-1.5 bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 flex items-center gap-1">
                  <span>🔒 承認待ち（入力不可）</span>
                </div>
              ) : !isSharedSelected && currentBed?.status === 'rejected' ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowCompletionModal(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-black text-xs rounded-xl shadow-md transition transform active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <span>📝 修正して再提出する</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setNotes('');
                    setHarvestAmount('');
                    if (isSharedSelected) {
                      setCustomCropName('全体共通');
                    } else if (currentBed) {
                      setCustomCropName(currentBedCrops.length === 1 ? currentBedCrops[0] : '');
                    } else {
                      setCustomCropName('');
                    }
                    setShowInputModal(true);
                  }}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-xs rounded-xl shadow-xs transition transform active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>＋ 新規記録</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedBedId(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-100 transition cursor-pointer"
                title="選択を解除して閉じる"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 承認待ちバナー */}
          {currentBed?.status === 'completed_pending' && (
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-300 text-xs text-amber-950 font-bold flex items-center gap-2.5">
              <span className="text-xl">⏳</span>
              <div>
                <p className="font-black text-amber-900">この畝は収穫完了報告済みです</p>
                <p className="text-[11px] text-amber-800 font-medium">
                  講師が確認・承認すると、この畝は過去ログ（「📦
                  過去の作物を見る」）に保存され、新しい畝が自動的に追加されます。承認までしばらくお待ちください。
                </p>
              </div>
            </div>
          )}

          {/* 🌟 差し戻し理由バナー 🌟 */}
          {currentBed?.status === 'rejected' && (
            <div className="p-4 bg-red-50 rounded-2xl border-2 border-red-300 text-xs text-red-950 font-bold space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <p className="font-black text-red-900 text-sm">講師からの差し戻しメッセージ</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-red-200 text-gray-800 font-bold">
                {currentBed?.reject_reason ||
                  currentBed?.completion_notes ||
                  '内容の再確認をお願いします'}
              </div>
              <p className="text-[11px] text-red-700">
                上記の内容をご確認の上、「📝
                修正して再提出する」ボタンから修正内容を送信してください。
              </p>
            </div>
          )}

          {/* 🌟 #2: 混植畝の場合の品種別フィルタータブ 🌟 */}
          {currentBed && currentBedCrops.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-[11px] text-gray-500 font-bold shrink-0">品種で絞り込み:</span>
              <button
                type="button"
                onClick={() => setSelectedCropFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-black text-xs transition cursor-pointer shrink-0 ${
                  selectedCropFilter === 'all'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                すべて ({currentBedRecords.length})
              </button>
              {currentBedCrops.map((crop) => {
                const count = currentBedRecords.filter((r) =>
                  isRecordMatchingCrop(r.crop_name, r.notes, crop)
                ).length;
                return (
                  <button
                    key={crop}
                    type="button"
                    onClick={() => setSelectedCropFilter(crop)}
                    className={`px-3 py-1.5 rounded-xl font-black text-xs transition cursor-pointer shrink-0 ${
                      selectedCropFilter === crop
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    {crop} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {filteredTimelineItems.length === 0 ? (
            <div className="py-12 text-center text-gray-400 font-bold text-sm space-y-3">
              <p>
                {selectedCropFilter === 'all'
                  ? 'この畝にはまだ記録が登録されていません。'
                  : `「${selectedCropFilter}」に関する記録はまだ登録されていません。`}
              </p>
              {currentBed?.status !== 'completed_pending' && (
                <button
                  onClick={() => {
                    setEditingRecord(null);
                    setShowInputModal(true);
                  }}
                  className="px-4 py-2 app-accent-btn font-bold text-xs rounded-xl shadow-xs"
                >
                  ＋ 初めての観察ログを登録する
                </button>
              )}
            </div>
          ) : (
            <div className="relative border-l-2 border-emerald-200 ml-4 pl-6 space-y-6 my-2">
              {filteredTimelineItems.map((item) => {
                if (item.type === 'teacher_reply') {
                  return (
                    <div key={item.id} className="relative group">
                      <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-amber-500 border-4 border-white shadow-xs group-hover:scale-125 transition"></div>

                      <div className="bg-amber-50/90 p-4 rounded-2xl border-2 border-amber-300 shadow-2xs hover:shadow-md transition space-y-2 text-xs font-bold text-gray-800">
                        <div className="flex justify-between items-center border-b border-amber-200/80 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-950 font-black text-[11px] flex items-center gap-1">
                              <span>💬 講師からの返信</span>
                            </span>
                            <span className="font-extrabold text-xs text-gray-800">
                              {item.teacherName}
                            </span>
                          </div>
                          <span className="font-bold text-[11px] text-gray-500">
                            📅 {item.dateStr}
                          </span>
                        </div>

                        {item.originalQuestion && (
                          <div className="text-[11px] text-gray-600 bg-white/70 p-2.5 rounded-xl border border-amber-200/60 font-medium">
                            <span className="text-[10px] text-amber-900 font-bold block mb-0.5">
                              📌 対象の相談・質問:
                            </span>
                            <p className="line-clamp-2 leading-relaxed">{item.originalQuestion}</p>
                          </div>
                        )}

                        <div className="bg-white p-3.5 rounded-xl border border-amber-200 text-gray-900 font-medium leading-relaxed whitespace-pre-wrap text-xs shadow-2xs">
                          {item.replyContent}
                        </div>
                      </div>
                    </div>
                  );
                }

                const rec = item.record;
                return (
                  <div key={rec.id} className="relative group">
                    <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-emerald-600 border-4 border-white shadow-xs group-hover:scale-125 transition"></div>

                    <div className="bg-gray-50/90 p-4 rounded-2xl border border-gray-200 shadow-2xs hover:shadow-md transition space-y-2 text-xs font-bold text-gray-700">
                      <div className="flex justify-between items-center border-b border-gray-200/80 pb-2">
                        <span className="font-black text-sm text-emerald-950">
                          📅 {formatDate(rec.date)}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full text-[11px]">
                            {rec.growth_stage || '作業完了'}
                          </span>

                          {/* 🌟 承認待ち以外の場合のみ「✏️ 編集」「🗑️ 削除」を表示 🌟 */}
                          {currentBed?.status !== 'completed_pending' && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(rec)}
                                className="px-2 py-1 bg-gray-200 hover:bg-emerald-100 text-gray-700 hover:text-emerald-900 rounded-lg text-[10px] font-extrabold transition"
                              >
                                ✏️ 編集
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(rec.id)}
                                className="px-2 py-1 bg-gray-200 hover:bg-red-100 text-gray-700 hover:text-red-700 rounded-lg text-[10px] font-extrabold transition"
                              >
                                🗑️ 削除
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-1 text-[11px]">
                        <div>
                          <span className="text-gray-400">草丈: </span>
                          <span className="text-gray-800 font-black">{rec.height_cm || 75} cm</span>
                        </div>
                        <div>
                          <span className="text-gray-400">実施内容: </span>
                          <span className="text-emerald-900 font-black">
                            {rec.work_types?.join(', ') || '観察・手入れ'}
                          </span>
                        </div>
                        {rec.harvest_amount && (
                          <div className="text-amber-800 font-black">
                            <span>成果: </span>
                            <span>{formatHarvestAmount(rec.harvest_amount)}</span>
                          </div>
                        )}
                      </div>

                      <p className="bg-white p-3 rounded-xl border text-gray-800 font-medium leading-relaxed">
                        {rec.notes}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 🌟 畝観察ノート・全体共有の下の「気づきメモ・講師への報告」 🌟 */}
          <div className="pt-4 border-t border-gray-200 space-y-2">
            <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
              <span>📝 気づきメモ・講師への報告</span>
              <span className="text-[11px] text-gray-400 font-normal">
                {isSharedSelected
                  ? '（区画全体・共通の状況を踏まえて講師へ送信）'
                  : `（畝 #${currentBed?.bed_number} の状況も踏まえて講師へ送信）`}
              </span>
            </h4>
            <div className="space-y-2">
              <textarea
                value={newJournal || ''}
                onChange={(e) => setNewJournal && setNewJournal(e.target.value)}
                placeholder={
                  isSharedSelected
                    ? '農園全体や区画共通の作業・気づき、講師への相談メモを入力...'
                    : `畝 ${currentBed?.bed_number} (${currentBed?.crop_name || '作物'}) についての気づきや相談、講師への日誌メモを入力...`
                }
                rows={3}
                className="w-full p-3 rounded-2xl border border-gray-300 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs font-medium leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onAddJournal}
                  disabled={!newJournal || !newJournal.trim()}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5 ${
                    newJournal && newJournal.trim()
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <span>✉️ 講師へメモを送信</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/90 p-6 rounded-3xl border border-dashed border-emerald-300 text-center space-y-2 text-gray-500 shadow-2xs">
          <span className="text-2xl">👆</span>
          <h4 className="font-extrabold text-gray-800 text-sm">畝または共通を選択してください</h4>
          <p className="text-xs text-gray-500 font-bold max-w-xs mx-auto leading-relaxed">
            上の畝番号をタップすると、その畝の栽培記録の確認や登録ができます。「共通」では全体の作業ログを確認できます。
          </p>
          <div className="pt-1 flex justify-center gap-2">
            <button
              type="button"
              onClick={handleSelectShared}
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-xs rounded-xl transition cursor-pointer shadow-2xs"
            >
              🌐 共通の記録を見る ({sharedRecordsCount}件)
            </button>
          </div>
        </div>
      )}

      {/* 登録・編集 Modal */}
      {showInputModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                <span>
                  {editingRecord ? '✏️ 過去の観察記録を編集' : '📝 観察ノート・作業結果の登録'}
                </span>
              </h3>
              <button
                onClick={() => setShowInputModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmitRecord}
              onPaste={handlePaste}
              className="space-y-4 text-xs font-bold"
            >
              <div>
                <label className="block text-gray-700 mb-1">対象の畝(ベッド) *</label>
                <select
                  value={selectedBedId || 'shared'}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedBedId(newId);
                    if (newId === 'shared') {
                      if (!customCropName || customCropName === '未確定 🌱') {
                        setCustomCropName('全体共通');
                      }
                    } else {
                      const b = activeBeds.find((item) => item.id === newId);
                      if (b?.crop_name && b.crop_name !== '未確定 🌱') {
                        setCustomCropName(b.crop_name);
                      }
                    }
                  }}
                  className="w-full p-3 rounded-2xl border-2 border-emerald-600 bg-emerald-50 text-emerald-950 font-black text-sm cursor-pointer"
                >
                  <option value="shared">🌐 共通</option>
                  {activeBeds.map((b) => {
                    const bedCrops = getBedAllCrops(
                      b.crop_name,
                      records.filter((r) => r.bed_id === b.id)
                    );
                    const cropLabel =
                      bedCrops.length > 0
                        ? bedCrops.join('、')
                        : b.crop_name && b.crop_name !== '未確定 🌱'
                          ? b.crop_name
                          : '';
                    return (
                      <option key={b.id} value={b.id}>
                        畝 {b.bed_number} {cropLabel ? `(${cropLabel})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">
                  栽培中の作物品種 (自由入力・変更可)
                </label>
                {/* 🌟 #3: 登録済みの品種がある場合はワンタップ選択チップを表示 🌟 */}
                {(() => {
                  const modalTargetBed =
                    selectedBedId !== 'shared'
                      ? activeBeds.find((item) => item.id === selectedBedId)
                      : null;
                  const modalTargetCrops = modalTargetBed
                    ? getBedAllCrops(
                        modalTargetBed.crop_name,
                        records.filter((r) => r.bed_id === modalTargetBed.id)
                      )
                    : [];

                  return (
                    <>
                      {modalTargetCrops.length > 0 && (
                        <div className="mb-2 p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-1.5">
                          <span className="text-[11px] font-black text-emerald-900 block">
                            🌱 この畝の品種からワンタップ選択:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {modalTargetCrops.map((crop) => (
                              <button
                                key={crop}
                                type="button"
                                onClick={() => setCustomCropName(crop)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                                  customCropName === crop
                                    ? 'bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-500'
                                    : 'bg-white text-emerald-900 hover:bg-emerald-100 border border-emerald-300'
                                }`}
                              >
                                <span>{customCropName === crop ? '✓' : '＋'}</span>
                                <span>{crop}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <input
                        type="text"
                        placeholder={
                          modalTargetCrops.length > 0
                            ? '上のボタンから選ぶか、新しい品種を自由入力'
                            : '例: きゅうり、ミニトマト、中玉トマト'
                        }
                        value={customCropName}
                        onChange={(e) => setCustomCropName(e.target.value)}
                        className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-bold text-sm"
                      />
                      <p className="text-[10px] text-gray-400 font-medium mt-1">
                        💡
                        複数の野菜を一緒に育てる（混植）場合は、「きゅうり、ミニトマト」のようにカンマで区切って入力すると同じ畝にまとめて登録できます。
                      </p>
                    </>
                  );
                })()}
              </div>

              <div>
                <label className="block text-gray-700 mb-1">📷 画像・写真を添付</label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) processImageFile(file);
                  }}
                  className="space-y-1.5"
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-gray-50 font-bold"
                  />
                  <p className="text-[10px] text-gray-400 font-medium">
                    💡
                    端末の写真選択のほか、画像をコピーしてこの画面で貼り付け（Ctrl+V）やドラッグ＆ドロップも可能です。
                  </p>
                  {imageUrl && (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-emerald-400 shadow-sm shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl}
                          alt="添付写真プレビュー"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 text-[11px] font-bold transition cursor-pointer"
                      >
                        ✕ 画像を解除
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">生育ステージ *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STAGES.map((stg) => (
                    <button
                      key={stg}
                      type="button"
                      onClick={() => setSelectedStage(stg)}
                      className={`p-2.5 rounded-xl border text-[11px] font-extrabold transition ${
                        selectedStage === stg
                          ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                          : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {stg}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">草丈 / 高さ (cm)</label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">行った作業 (複数選択可)</label>
                <div className="flex flex-wrap gap-2">
                  {WORKS.map((wk) => {
                    const isChecked = selectedWorks.includes(wk);
                    return (
                      <button
                        key={wk}
                        type="button"
                        onClick={() => handleToggleWork(wk)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                          isChecked
                            ? 'bg-amber-500 text-amber-950 border-amber-600 font-black'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}
                      >
                        {isChecked ? '✓ ' : ''}
                        {wk}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">収穫量 (収穫を行った場合)</label>
                <input
                  type="text"
                  placeholder="例: トマト 5個 / 300g"
                  value={harvestAmount}
                  onChange={(e) => setHarvestAmount(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">観察ノート・感想 *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="本日の観察結果や作業の気づきを入力してください...（画像の直接貼り付け Ctrl+V も可能です）"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onPaste={handlePaste}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 font-medium text-xs leading-relaxed"
                />
              </div>

              {/* 🌟 講師への相談・質問 ❗ フラグ 🌟 */}
              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-300 space-y-2">
                <label className="flex items-center space-x-2 font-black text-amber-950 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notes.includes('❗ [相談]')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        if (!notes.includes('❗ [相談]')) {
                          setNotes('❗ [相談] ' + notes);
                        }
                      } else {
                        setNotes(notes.replace('❗ [相談] ', '').replace('❗ [相談]', ''));
                      }
                    }}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <span>❗ 講師に相談・質問を通知する (要アドバイス)</span>
                </label>
                <p className="text-[10px] text-amber-800 font-bold">
                  チェックを入れると講師画面のあなたの区画に「❗」バッジが表示され、講師がすぐに相談を確認できます。
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowInputModal(false)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRecord}
                  className={`px-6 py-2.5 font-black rounded-xl shadow-md transition ${
                    isSubmittingRecord
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-600 text-amber-950 cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  {isSubmittingRecord
                    ? '登録中...'
                    : editingRecord
                      ? '変更内容を更新する'
                      : '結果を登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 4. 収穫完了報告モーダル 🌟 */}
      <BedCompletionModal
        isOpen={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        bed={currentBed}
        onComplete={async (details) => {
          if (currentBed && myPlot) {
            // 即時ローカルロック（UI即座切り替え）

            await completeBedCrop(myPlot.id || myPlot.code, currentBed.id, details);
            setToastMessage(
              `🎉 畝 ${currentBed.bed_number} の収穫完了報告を講師へ送信しました！講師の承認をお待ちください。`
            );
            setShowToast(true);
          }
        }}
      />

      {/* 🌟 5. 過去の作物・アーカイブ閲覧モーダル 🌟 */}
      <ArchivedCropsModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        archivedBeds={archivedBeds}
        records={records.filter((r) => archivedBeds.some((b) => b.id === r.bed_id))}
        isTeacher={false}
      />
    </div>
  );
}
