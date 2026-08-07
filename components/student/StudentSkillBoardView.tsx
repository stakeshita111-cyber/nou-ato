"use client";

interface StudentSkillBoardViewProps {
  tasks: any[];
  user: any;
}

export default function StudentSkillBoardView({ tasks, user }: StudentSkillBoardViewProps) {
  const completedTasks = tasks.filter((t) => t.status === "completed");

  // 経験値計算
  const totalExp = completedTasks.length * 50;
  const level = Math.floor(totalExp / 100) + 1;
  const expProgress = totalExp % 100;

  // デフォルトバッジリスト
  const defaultBadges = [
    { id: "b1", title: "農の跡・第一歩", icon: "🌱", desc: "受講登録完了", unlocked: true },
    { id: "b2", title: "土作りマスター", icon: "🚜", desc: "土作り・畝立て完了", unlocked: completedTasks.length >= 1 },
    { id: "b3", title: "芽かきプロ", icon: "✂️", desc: "芽かき作業をマスター", unlocked: completedTasks.length >= 2 },
    { id: "b4", title: "収穫の喜び", icon: "🧺", desc: "収穫・報告完了", unlocked: completedTasks.length >= 3 },
  ];

  // 講師がタスク設定で指定したバッジを動的統合
  const customBadges = completedTasks
    .filter((ct) => ct.tasks?.badge_name || ct.badge_name)
    .map((ct, idx) => ({
      id: `custom_b_${idx}`,
      title: ct.tasks?.badge_name || ct.badge_name,
      icon: ct.tasks?.badge_icon || ct.badge_icon || "🏆",
      desc: `${ct.tasks?.title || ct.title} クリア`,
      unlocked: true,
    }));

  const allBadges = [...customBadges, ...defaultBadges];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. レベル & EXPカード */}
      <div className="bg-gradient-to-br from-[#1d5c23] to-[#2e7d32] rounded-3xl p-6 text-white shadow-lg space-y-4 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 font-black text-2xl flex items-center justify-center shadow-inner">
              Lv.{level}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-200">農業スキル等級</span>
              <h3 className="text-xl font-black">見習い農家</h3>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xl font-black">{totalExp}</span>
            <span className="text-xs font-bold text-green-200"> EXP</span>
          </div>
        </div>

        {/* 経験値プログレスバー */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-bold text-green-100">
            <span>次のレベルまで</span>
            <span>{100 - expProgress} EXP</span>
          </div>
          <div className="w-full h-3 bg-black/20 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-700 shadow-sm"
              style={{ width: `${Math.max(expProgress, 8)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 2. 獲得スキル・バッジコレクション (講師設定バッジを動的表示) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">🏆 獲得農作業バッジ</h3>
          <span className="text-xs font-bold text-gray-500">
            {allBadges.filter((b) => b.unlocked).length} 獲得
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {allBadges.map((badge) => (
            <div
              key={badge.id}
              className={`p-3.5 rounded-2xl border transition flex items-center space-x-3 ${
                badge.unlocked
                  ? "bg-white border-green-200 shadow-xs"
                  : "bg-gray-100/70 border-gray-200 opacity-50"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                badge.unlocked ? "bg-green-50" : "bg-gray-200"
              }`}>
                {badge.icon}
              </div>
              <div>
                <h4 className="font-bold text-xs text-gray-900">{badge.title}</h4>
                <p className="text-[10px] text-gray-500">{badge.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. 成長の足跡・完了済みクエストログ */}
      <div className="space-y-3">
        <h3 className="font-bold text-gray-900 text-sm">📜 クエスト達成の足跡</h3>

        {completedTasks.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 text-center space-y-1 text-xs text-gray-400">
            <p className="font-bold text-gray-700">まだ達成したクエストはありません</p>
            <p>Questsタブからタスクを完了して、足跡を刻みましょう！</p>
          </div>
        ) : (
          <div className="space-y-3">
            {completedTasks.map((ct) => (
              <div
                key={ct.id}
                className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-start space-x-3"
              >
                <div className="w-8 h-8 rounded-full bg-green-100 text-[#1d5c23] font-black flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                  ✓
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-900 text-xs">{ct.tasks?.title || ct.title}</h4>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      +50 EXP
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 line-clamp-1">
                    {ct.tasks?.description || "無事に作業完了を報告しました。"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
