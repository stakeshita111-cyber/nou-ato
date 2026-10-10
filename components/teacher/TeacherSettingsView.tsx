'use client';

import { useEffect, useState } from 'react';
import Toast from '@/components/ui/Toast';
import { useThemeStore, ThemeSettings } from '@/store/useThemeStore';
import { formatDate, formatNumber } from '@/lib/utils/formatHelper';
import { PresetFaqItem } from '@/types/farm';
import { DEFAULT_PRESET_FAQS } from '@/lib/presetFaqs';

export default function TeacherSettingsView() {
  const { settings, updateSettings, resetSettings } = useThemeStore();

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 💡 農園独自のクイック相談（よくある質問）リスト
  const [presetFaqs, setPresetFaqs] = useState<PresetFaqItem[]>(DEFAULT_PRESET_FAQS);
  const [editingFaq, setEditingFaq] = useState<PresetFaqItem | null>(null);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);

  // DBから最新の設定値を同期取得
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.showStudentTalkTab !== undefined) {
            updateSettings({ showStudentTalkTab: data.showStudentTalkTab !== false });
          }
          if (data.presetFaqs && Array.isArray(data.presetFaqs) && data.presetFaqs.length > 0) {
            setPresetFaqs(data.presetFaqs);
          }
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      }
    };
    fetchSettings();
  }, [updateSettings]);

  const handleSaveFaqsToDb = async (updatedList: PresetFaqItem[]) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetFaqs: updatedList }),
      });
      if (!res.ok) throw new Error('保存に失敗しました');
      setPresetFaqs(updatedList);
      setToastMessage('✨ 生徒向けクイック質問チップを保存しました！');
      setShowToast(true);
    } catch {
      setToastMessage('⚠️ 設定の保存に失敗しました');
      setShowToast(true);
    }
  };

  const handleOpenAddFaqModal = () => {
    setEditingFaq({
      id: 'faq_' + Date.now(),
      chipLabel: '🌱 新しい質問',
      question: '',
      answer: '',
    });
    setIsFaqModalOpen(true);
  };

  const handleOpenEditFaqModal = (faq: PresetFaqItem) => {
    setEditingFaq({ ...faq });
    setIsFaqModalOpen(true);
  };

  const handleDeleteFaq = async (id: string) => {
    if (presetFaqs.length <= 1) {
      setToastMessage('⚠️ 最低1つの質問チップを残してください');
      setShowToast(true);
      return;
    }
    const updated = presetFaqs.filter((f) => f.id !== id);
    await handleSaveFaqsToDb(updated);
  };

  const handleResetFaqsToDefault = async () => {
    if (window.confirm('質問チップを初期標準の4問（追肥・黄変・害虫・水やり）に戻しますか？')) {
      await handleSaveFaqsToDb(DEFAULT_PRESET_FAQS);
    }
  };

  const handleSaveFaqModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq) return;
    if (!editingFaq.chipLabel.trim() || !editingFaq.question.trim() || !editingFaq.answer.trim()) {
      setToastMessage('⚠️ すべての項目を入力してください');
      setShowToast(true);
      return;
    }

    const exists = presetFaqs.some((f) => f.id === editingFaq.id);
    let updated: PresetFaqItem[];
    if (exists) {
      updated = presetFaqs.map((f) => (f.id === editingFaq.id ? editingFaq : f));
    } else {
      updated = [...presetFaqs, editingFaq];
    }

    setIsFaqModalOpen(false);
    setEditingFaq(null);
    await handleSaveFaqsToDb(updated);
  };

  const handleToggleContrast = (enabled: boolean) => {
    updateSettings({ outdoorHighContrast: enabled });
    setToastMessage(`✨ 高コントラスト表示を ${enabled ? 'ON' : 'OFF'} に切り替えました！`);
    setShowToast(true);
  };

  const sampleDate = new Date();
  const sampleHarvest = 1500;

  // フォントファミリーのインラインCSSマッピング
  const getFontFamilyCss = (family: ThemeSettings['fontFamily']) => {
    if (family === 'serif') return 'Georgia, Cambria, "Times New Roman", Times, serif';
    if (family === 'rounded')
      return '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", sans-serif';
    return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  };

  // ボタンの角丸形状マッピング
  const getBorderRadiusClass = (radius: ThemeSettings['borderRadius']) => {
    if (radius === 'none') return 'rounded-none';
    if (radius === 'full') return 'rounded-full';
    return 'rounded-xl';
  };

  // 手袋パディングサイズマッピング
  const getButtonPaddingClass = (padding: ThemeSettings['buttonPadding']) => {
    if (padding === 'large') return 'px-8 py-3.5 text-base font-black shadow-md';
    return 'px-4 py-2 text-xs font-bold shadow-xs';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-gray-800 pb-24 pt-[180px] font-sans relative">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* 🌟 メインカラム (サイドバーw-64を除外) と100%横位置・横幅が一致する常時フローティングプレビュー 🌟 */}
      <div className="fixed top-[72px] left-0 md:left-64 right-0 z-40 flex justify-center px-4 sm:px-8 pointer-events-none">
        <div className="max-w-4xl w-full pointer-events-auto">
          <div
            className={`p-3.5 sm:p-4 rounded-2xl border shadow-xl backdrop-blur-md transition-all space-y-2.5 ${
              settings.outdoorHighContrast
                ? 'bg-amber-50/95 border-amber-400 ring-2 ring-amber-300'
                : 'bg-white/95 border-emerald-300 ring-1 ring-emerald-200'
            }`}
            style={{ fontFamily: getFontFamilyCss(settings.fontFamily) }}
          >
            {/* 上段: 受講生プロフ (メインカラー反映) ＆ 日付表記サンプル (日付表記形式反映) */}
            <div className="flex items-center justify-between border-b border-gray-200/80 pb-2">
              <div className="flex items-center space-x-2.5">
                <div
                  className="w-7 h-7 rounded-lg font-black text-white flex items-center justify-center text-[11px] shadow-2xs shrink-0"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  山田
                </div>
                <span className="font-bold text-xs text-gray-900">山田 太郎 様 (区画1)</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-950 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                📅 {formatDate(sampleDate, settings.dateFormat)}
              </span>
            </div>

            {/* 中段: タイポグラフィサンプル (文字サイズ・太さ・行間反映) ＆ 収穫量表記 (数値形式反映) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-gray-50/90 p-2.5 rounded-xl border border-gray-200/80">
              <p
                className={`text-gray-900 ${
                  settings.fontSize === 'small'
                    ? 'text-xs'
                    : settings.fontSize === 'large'
                      ? 'text-base'
                      : settings.fontSize === 'xlarge'
                        ? 'text-lg font-black'
                        : 'text-sm'
                } ${
                  settings.fontWeight === 'bold'
                    ? 'font-black'
                    : settings.fontWeight === 'medium'
                      ? 'font-medium'
                      : 'font-normal'
                } ${
                  settings.lineHeight === 'loose'
                    ? 'leading-loose'
                    : settings.lineHeight === 'relaxed'
                      ? 'leading-relaxed'
                      : 'leading-normal'
                }`}
              >
                文字サイズ・太さ・書体・行間 視認性確認テキスト
              </p>

              <div className="text-xs font-black text-amber-800 shrink-0 bg-white px-2.5 py-1 rounded-lg border border-amber-200/80 shadow-2xs">
                📊 収穫記録: {formatNumber(sampleHarvest, settings.numberFormat, 'g')}
              </div>
            </div>

            {/* 下段: サンプルボタン (メインカラー・角丸形状・ボタンサイズ反映) */}
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[10px] text-gray-400 font-bold">
                ✨ 下の設定ボタンを押すと各項目がプレビューにリアルタイム反映されます
              </span>
              <div
                aria-hidden="true"
                className={`text-white font-bold transition-all shadow-xs pointer-events-none select-none ${getBorderRadiusClass(settings.borderRadius)} ${getButtonPaddingClass(settings.buttonPadding)}`}
                style={{ backgroundColor: settings.primaryColor }}
              >
                ＋ サンプルボタン (見た目プレビュー)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📋 設定項目一覧テーブル 📋 */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center font-bold text-xs text-gray-700">
          <span>設定項目 ＆ 説明</span>
          <span>選択肢（クリック/タップで一発変更）</span>
        </div>

        <div className="divide-y divide-gray-100 text-xs font-bold">
          {/* 1. 農園メインカラー */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">🎨 農園メインカラー</span>
              <span className="text-[11px] text-gray-500 font-medium">
                基調テーマカラーを選択します
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'キャベツグリーン', color: '#10b981', sec: '#f59e0b' },
                { label: 'シトラスオレンジ', color: '#e06d2d', sec: '#f59e0b' },
                { label: 'ストロベリーピンク', color: '#d8527c', sec: '#f59e0b' },
                { label: 'サファイアブルー', color: '#3182ce', sec: '#f59e0b' },
              ].map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    updateSettings({ primaryColor: c.color, secondaryColor: c.sec });
                    setToastMessage(`🎨 カラーを「${c.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl border flex items-center space-x-2 transition ${
                    settings.primaryColor === c.color
                      ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-white shrink-0 shadow-2xs"
                    style={{ backgroundColor: c.color }}
                  />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. 文字の大きさ */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">
                🔤 文字の大きさ (屋外ズーム)
              </span>
              <span className="text-[11px] text-gray-500 font-medium">
                画面全体のフォントサイズを一括調整します
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '小 (14px)', value: 'small' },
                { label: '標準 (16px)', value: 'medium' },
                { label: '大 (20px)', value: 'large' },
                { label: '極大 (24px) ⚠️推奨', value: 'xlarge' },
              ].map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ fontSize: s.value as ThemeSettings['fontSize'] });
                    setToastMessage(`🔤 文字サイズを「${s.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl border transition ${
                    settings.fontSize === s.value
                      ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. フォント種類 */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">🔤 フォント種類</span>
              <span className="text-[11px] text-gray-500 font-medium">文字の書体を変更します</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'ゴシック (標準)', value: 'sans' },
                { label: '明朝体 (上品)', value: 'serif' },
                { label: '丸ゴシック (読みやすい)', value: 'rounded' },
              ].map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ fontFamily: f.value as ThemeSettings['fontFamily'] });
                    setToastMessage(`🔤 フォント書体を「${f.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl border transition ${
                    settings.fontFamily === f.value
                      ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. 文字の太さ (日差し対策) */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">
                ✒️ 文字の太さ (日差し反射対策)
              </span>
              <span className="text-[11px] text-gray-500 font-medium">
                直射日光下で文字の輪郭を浮き立たせます
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '標準 (細め)', value: 'normal' },
                { label: '中 (読みやすい)', value: 'medium' },
                { label: '極太 (クッキリ)', value: 'bold' },
              ].map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ fontWeight: w.value as ThemeSettings['fontWeight'] });
                    setToastMessage(`✒️ 文字の太さを「${w.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl border transition ${
                    settings.fontWeight === w.value
                      ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. 文章の行間 */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">
                ↕️ 文章の行間 (誤読予防)
              </span>
              <span className="text-[11px] text-gray-500 font-medium">
                行間の隙間を広げて視認性を高めます
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '標準', value: 'normal' },
                { label: 'ゆったり', value: 'relaxed' },
                { label: '広い (誤読防止)', value: 'loose' },
              ].map((lh) => (
                <button
                  key={lh.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ lineHeight: lh.value as ThemeSettings['lineHeight'] });
                    setToastMessage(`↕️ 行間を「${lh.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl border transition ${
                    settings.lineHeight === lh.value
                      ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {lh.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6. ボタンの形 (明確変化) */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">🔘 ボタンの形状</span>
              <span className="text-[11px] text-gray-500 font-medium">
                ボタンの角の丸みを変更します
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '四角形 (角なし)', value: 'none' },
                { label: '角丸 (標準)', value: 'md' },
                { label: '楕円丸 (完全丸形)', value: 'full' },
              ].map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ borderRadius: r.value as ThemeSettings['borderRadius'] });
                    setToastMessage(`🔘 ボタン形状を「${r.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 border transition ${
                    r.value === 'none'
                      ? 'rounded-none'
                      : r.value === 'full'
                        ? 'rounded-full'
                        : 'rounded-xl'
                  } ${
                    settings.borderRadius === r.value
                      ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* 7. ボタンサイズ */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">🔘 ボタンサイズ</span>
              <span className="text-[11px] text-gray-500 font-medium">
                ボタンの表示サイズを変更します
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '標準', value: 'normal' },
                { label: '大', value: 'large' },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ buttonPadding: p.value as ThemeSettings['buttonPadding'] });
                    setToastMessage(`🔘 ボタンサイズを「${p.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`border transition ${
                    p.value === 'large'
                      ? 'px-6 py-3.5 text-sm font-black'
                      : 'px-3.5 py-2 text-xs font-bold'
                  } rounded-xl ${
                    settings.buttonPadding === p.value
                      ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 8. 高コントラストモード */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">
                ☀️ 高コントラスト表示モード
              </span>
              <span className="text-[11px] text-gray-500 font-medium">
                直射日光下の白飛び防止用高輝度モード
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleToggleContrast(false)}
                className={`px-3.5 py-2 rounded-xl border transition ${
                  !settings.outdoorHighContrast
                    ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                標準表示 (OFF)
              </button>
              <button
                type="button"
                onClick={() => handleToggleContrast(true)}
                className={`px-3.5 py-2 rounded-xl border transition ${
                  settings.outdoorHighContrast
                    ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                高コントラスト (ON)
              </button>
            </div>
          </div>

          {/* 9. 日付の書き方 */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">📅 日付の表記スタイル</span>
              <span className="text-[11px] text-gray-500 font-medium">
                日付の表示フォーマットを選択します
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '8月14日(金)', value: 'japanese' },
                { label: '2026/08/14', value: 'slash' },
              ].map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ dateFormat: d.value as ThemeSettings['dateFormat'] });
                    setToastMessage(`📅 日付表記を「${d.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl border transition ${
                    settings.dateFormat === d.value
                      ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* 10. 収穫量・数値表記 */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">📊 収穫量・数値表記</span>
              <span className="text-[11px] text-gray-500 font-medium">
                数値と単位の表示フォーマットを選択します
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '単位あり (1,500g)', value: 'unit' },
                { label: 'カンマあり (1,500)', value: 'comma' },
                { label: 'そのまま (1500)', value: 'raw' },
              ].map((num) => (
                <button
                  key={num.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ numberFormat: num.value as ThemeSettings['numberFormat'] });
                    setToastMessage(`📊 数値表記を「${num.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl border transition ${
                    settings.numberFormat === num.value
                      ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {num.label}
                </button>
              ))}
            </div>
          </div>

          {/* 11. 講師画面: 収支シミュレーションメニューの表示 */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">
                💳 講師画面: 収支シミュレーションメニューの表示
              </span>
              <span className="text-[11px] text-gray-500 font-medium">
                左サイドバーの「収支シミュレーション」メニューの表示・非表示を切り替えます（基本は非表示）
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  updateSettings({ showPaymentsMenu: true });
                  setToastMessage('💳 収支シミュレーションメニューを「表示 (ON)」に設定しました');
                  setShowToast(true);
                }}
                className={`px-3.5 py-2 rounded-xl border transition ${
                  settings.showPaymentsMenu === true
                    ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                表示 (ON)
              </button>
              <button
                type="button"
                onClick={() => {
                  updateSettings({ showPaymentsMenu: false });
                  setToastMessage(
                    '💳 収支シミュレーションメニューを「非表示 (OFF)」に設定しました'
                  );
                  setShowToast(true);
                }}
                className={`px-3.5 py-2 rounded-xl border transition ${
                  !settings.showPaymentsMenu
                    ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                非表示 (OFF)
              </button>
            </div>
          </div>

          {/* 12. 生徒画面: 相談・質問機能の表示 */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">
                💬 生徒画面: 相談・質問機能（Talk）の表示
              </span>
              <span className="text-[11px] text-gray-500 font-medium">
                生徒画面下部ナビゲーションの「相談」タブの表示・非表示を切り替えます
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  updateSettings({ showStudentTalkTab: true });
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('nouato_show_student_talk_tab', 'true');
                    window.dispatchEvent(
                      new CustomEvent('nouato_talk_tab_toggled', { detail: { show: true } })
                    );
                    window.dispatchEvent(
                      new CustomEvent('nouato_settings_updated', {
                        detail: { ...settings, showStudentTalkTab: true },
                      })
                    );
                    try {
                      const bc = new BroadcastChannel('nouato_settings_sync');
                      bc.postMessage({ type: 'TALK_TAB_TOGGLE', show: true });
                      bc.postMessage({
                        type: 'SETTINGS_UPDATED',
                        settings: { ...settings, showStudentTalkTab: true },
                      });
                    } catch (e) {}
                    // プレビュー用iframeへの直接postMessage送信
                    document.querySelectorAll('iframe').forEach((iframe) => {
                      try {
                        iframe.contentWindow?.postMessage(
                          { type: 'TALK_TAB_TOGGLE', show: true },
                          '*'
                        );
                      } catch (e) {}
                    });
                    // サーバー共有APIへの保存（全端末リアルタイム同期）
                    fetch('/api/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ showStudentTalkTab: true }),
                    }).catch(() => {});
                  }
                  setToastMessage('💬 生徒の相談画面を「表示 (ON)」に設定しました');
                  setShowToast(true);
                }}
                className={`px-3.5 py-2 rounded-xl border transition ${
                  settings.showStudentTalkTab !== false
                    ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                表示 (ON)
              </button>
              <button
                type="button"
                onClick={() => {
                  updateSettings({ showStudentTalkTab: false });
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('nouato_show_student_talk_tab', 'false');
                    window.dispatchEvent(
                      new CustomEvent('nouato_talk_tab_toggled', { detail: { show: false } })
                    );
                    window.dispatchEvent(
                      new CustomEvent('nouato_settings_updated', {
                        detail: { ...settings, showStudentTalkTab: false },
                      })
                    );
                    try {
                      const bc = new BroadcastChannel('nouato_settings_sync');
                      bc.postMessage({ type: 'TALK_TAB_TOGGLE', show: false });
                      bc.postMessage({
                        type: 'SETTINGS_UPDATED',
                        settings: { ...settings, showStudentTalkTab: false },
                      });
                    } catch (e) {}
                    // プレビュー用iframeへの直接postMessage送信
                    document.querySelectorAll('iframe').forEach((iframe) => {
                      try {
                        iframe.contentWindow?.postMessage(
                          { type: 'TALK_TAB_TOGGLE', show: false },
                          '*'
                        );
                      } catch (e) {}
                    });
                    // サーバー共有APIへの保存（全端末リアルタイム同期）
                    fetch('/api/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ showStudentTalkTab: false }),
                    }).catch(() => {});
                  }
                  setToastMessage('💬 生徒の相談画面を「非表示 (OFF)」に設定しました');
                  setShowToast(true);
                }}
                className={`px-3.5 py-2 rounded-xl border transition ${
                  settings.showStudentTalkTab === false
                    ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                非表示 (OFF)
              </button>
            </div>
          </div>

          {/* 13. 生徒画面: タッチで聞けるクイック相談（よくある質問）の管理 */}
          <div className="p-5 flex flex-col gap-4 hover:bg-gray-50/50 transition">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <span>💡 生徒向けクイック相談（よくある質問）のカスタマイズ</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    全 {presetFaqs.length} 件
                  </span>
                </span>
                <span className="text-[11px] text-gray-500 font-medium">
                  生徒の相談画面下部に並ぶ無料の質問チップと、即座に返信されるアドバイス本文を農園独自に設定できます
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenAddFaqModal}
                  className="px-3.5 py-2 bg-[#1c4d21] hover:bg-[#153e19] text-white rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <span>＋ 新規追加</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetFaqsToDefault}
                  title="初期の標準4問に戻す"
                  className="px-3 py-2 bg-white hover:bg-gray-100 text-gray-600 border border-gray-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  <span>🔄 初期標準に戻す</span>
                </button>
              </div>
            </div>

            {/* チップ一覧カード表示 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {presetFaqs.map((faq, idx) => (
                <div
                  key={faq.id || idx}
                  className="bg-white border border-gray-200 rounded-2xl p-3.5 shadow-2xs space-y-2 text-left hover:border-emerald-300 transition"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="text-xs font-extrabold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      {faq.chipLabel}
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditFaqModal(faq)}
                        className="px-2 py-1 text-xs text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg font-bold transition cursor-pointer"
                      >
                        ✏️ 編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFaq(faq.id)}
                        className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg font-bold transition cursor-pointer"
                      >
                        🗑️ 削除
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block">
                      【生徒の質問文】
                    </span>
                    <p className="text-xs text-gray-800 font-bold line-clamp-1">{faq.question}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block">
                      【即答アドバイス返答】
                    </span>
                    <p className="text-xs text-gray-600 line-clamp-2 whitespace-pre-wrap">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 下部初期化ボタン */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center flex-wrap gap-2">
          <span className="text-xs text-gray-500 font-bold">
            💡 選択した設定は端末のローカルストレージおよび農園設定に保存されます
          </span>
          <button
            type="button"
            onClick={() => {
              resetSettings();
              setToastMessage('🔄 すべてのカスタマイズ設定を標準初期状態に戻しました');
              setShowToast(true);
            }}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition shadow-2xs"
          >
            🔄 初期設定に戻す
          </button>
        </div>
      </div>

      {/* 🌟 クイック質問チップ作成・編集モーダル 🌟 */}
      {isFaqModalOpen && editingFaq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-gray-200 relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <span>💬 クイック相談チップの編集</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFaqModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSaveFaqModalSubmit}
              className="space-y-4 flex-1 overflow-y-auto pr-1"
            >
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  チップ表示名 (絵文字 + 簡潔なキーワード)
                </label>
                <input
                  type="text"
                  value={editingFaq.chipLabel}
                  onChange={(e) => setEditingFaq({ ...editingFaq, chipLabel: e.target.value })}
                  placeholder="例: 🥦 収穫のサイン, 🐛 害虫対策"
                  required
                  className="w-full px-3.5 py-2.5 bg-gray-50 focus:bg-white border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  タップ時に送信される質問文
                </label>
                <input
                  type="text"
                  value={editingFaq.question}
                  onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                  placeholder="例: ブロッコリーの収穫適期や見極め方を教えてください"
                  required
                  className="w-full px-3.5 py-2.5 bg-gray-50 focus:bg-white border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  即座に返信される農園アドバイス本文 (AIチケット非消費)
                </label>
                <textarea
                  value={editingFaq.answer}
                  onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                  placeholder="例: 【農園アドバイス：ブロッコリーの収穫】🥦&#10;&#10;花蕾（つぼみ）が固く締まって直径10〜15cmほどになったら収穫適期です！朝の涼しい時間帯に茎を斜めに切り落としてくださいね。"
                  required
                  rows={4}
                  className="w-full p-3 bg-gray-50 focus:bg-white border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] resize-none leading-relaxed"
                />
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFaqModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1c4d21] hover:bg-[#153e19] text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
