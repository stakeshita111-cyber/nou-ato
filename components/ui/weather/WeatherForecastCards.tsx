'use client';

import { useState } from 'react';
import { getWeatherIcon, getWeatherText, type WeatherData, type HourlyPoint } from './types';

interface WeatherForecastCardsProps {
  weather: WeatherData;
  activeTab: '24h' | 'daily' | 'level';
  setActiveTab: (tab: '24h' | 'daily' | 'level') => void;
  showMobileDetails: boolean;
  setShowMobileDetails: React.Dispatch<React.SetStateAction<boolean>>;
  showSourceTooltip: boolean;
  setShowSourceTooltip: (show: boolean) => void;
}

export function WeatherForecastCards({
  weather,
  activeTab,
  setActiveTab,
  showMobileDetails,
  setShowMobileDetails,
  showSourceTooltip,
  setShowSourceTooltip,
}: WeatherForecastCardsProps) {
  const [hoveredPointInfo, setHoveredPointInfo] = useState<{
    x: number;
    y: number;
    hourData: HourlyPoint;
  } | null>(null);

  const render24hLineChart = () => {
    const data = weather.hourly;
    const width = 800; // グラフ横幅全幅表示
    const height = 95; // 縦の余白を詰めてコンパクト化
    const paddingLeft = 40;
    const paddingRight = 20;

    const temps = data.map((d) => [d.tempActual, d.tempPredicted]).flat();
    let minTemp = Math.min(...temps) - 2;
    let maxTemp = Math.max(...temps) + 2;
    if (minTemp === maxTemp) {
      minTemp -= 2;
      maxTemp += 2;
    }
    const tempRange = maxTemp - minTemp;
    const midTemp = Math.round((minTemp + maxTemp) / 2);
    const svgTotalHeight = 125; // 下部余白を大幅カット

    const plotTop = 12;
    const plotBottom = height;
    const plotHeight = plotBottom - plotTop;

    const getYForTemp = (tempVal: number) =>
      plotBottom - ((tempVal - minTemp) / tempRange) * plotHeight;

    const points = data.map((d, index) => {
      const x = paddingLeft + (index / (data.length - 1)) * (width - paddingLeft - paddingRight);
      const yActual = getYForTemp(d.tempActual);
      const yPredicted = getYForTemp(d.tempPredicted);
      return {
        x,
        yActual,
        yPredicted,
        tempActual: d.tempActual,
        tempPredicted: d.tempPredicted,
        time: d.time,
        hour: d.hour,
        isPast: d.isPast,
        isCurrent: d.isCurrent,
        rawData: d,
      };
    });

    const nowHour = new Date().getHours();
    let currentIdx = points.findIndex((p) => p.isCurrent);
    if (currentIdx === -1) {
      currentIdx = nowHour < 4 ? 0 : points.length - 1;
    }
    const currentP = points[currentIdx];

    const actualPoints = points.slice(0, currentIdx + 1);
    const actualPolyline = actualPoints.map((p) => `${p.x},${p.yActual}`).join(' ');

    const futurePoints = points.slice(currentIdx);
    const futurePolyline = futurePoints.map((p) => `${p.x},${p.yPredicted}`).join(' ');

    // 現在または選択中の時間の気象データ
    const displayData = hoveredPointInfo
      ? hoveredPointInfo.hourData
      : currentP
        ? currentP.rawData
        : data[0];

    // 選択時刻に連動する時間単位のリアルタイム農業指標計算
    const activeWind = displayData ? displayData.wind : weather.today.windSpeed;
    const activeRainSum = displayData ? displayData.rain : weather.today.rainSum;
    const activeRainProb = displayData ? displayData.rainProb : 0;
    const activeTemp = displayData
      ? displayData.isPast
        ? displayData.tempActual
        : displayData.tempPredicted
      : weather.today.tempMax;
    const activeWeather = displayData ? displayData.weather : 'sunny';

    // ▼ 7つの時間単位指標 (Hourly Indicators) 計算 (シンプルで伝わる短縮テキスト & カラー)
    const sprayStatusText =
      activeWind > 5 || activeRainProb >= 70 ? '中止' : activeWind >= 3 ? '注意' : '最適';
    const sprayColorClass =
      activeWind > 5 || activeRainProb >= 70
        ? 'bg-red-500 text-white'
        : activeWind >= 3
          ? 'bg-amber-400 text-amber-950'
          : 'bg-emerald-500 text-white';

    const heatStatusText = activeTemp >= 32 ? '中止' : activeTemp >= 28 ? '注意' : '快適';
    const heatColorClass =
      activeTemp >= 32
        ? 'bg-red-500 text-white'
        : activeTemp >= 28
          ? 'bg-amber-400 text-amber-950'
          : 'bg-emerald-500 text-white';

    const photoStatusText =
      activeWeather === 'rainy' || activeWeather === 'storm'
        ? '低下'
        : activeTemp >= 20 && activeTemp <= 30 && activeWeather === 'sunny'
          ? '活発'
          : '標準';
    const photoColorClass =
      activeWeather === 'rainy' || activeWeather === 'storm'
        ? 'bg-red-500 text-white'
        : activeTemp >= 20 && activeTemp <= 30 && activeWeather === 'sunny'
          ? 'bg-emerald-500 text-white'
          : 'bg-amber-400 text-amber-950';

    const evapTransStatusText =
      activeTemp < 15 || activeWeather === 'rainy'
        ? '停滞'
        : activeTemp >= 22 && activeWeather === 'sunny'
          ? '盛ん'
          : '標準';
    const evapTransColorClass =
      activeTemp < 15 || activeWeather === 'rainy'
        ? 'bg-red-500 text-white'
        : activeTemp >= 22 && activeWeather === 'sunny'
          ? 'bg-emerald-500 text-white'
          : 'bg-amber-400 text-amber-950';

    const leafWetStatusText =
      activeRainSum > 0 || activeRainProb >= 60 ? '高湿' : activeRainProb >= 30 ? '湿潤' : '乾燥';
    const leafWetColorClass =
      activeRainSum > 0 || activeRainProb >= 60
        ? 'bg-red-500 text-white'
        : activeRainProb >= 30
          ? 'bg-amber-400 text-amber-950'
          : 'bg-emerald-500 text-white';

    const diseaseRiskStatusText =
      activeRainSum >= 5 || (activeRainProb >= 60 && activeTemp >= 25)
        ? '高'
        : activeRainProb >= 40
          ? '注意'
          : '低';
    const diseaseRiskColorClass =
      activeRainSum >= 5 || (activeRainProb >= 60 && activeTemp >= 25)
        ? 'bg-red-500 text-white'
        : activeRainProb >= 40
          ? 'bg-amber-400 text-amber-950'
          : 'bg-emerald-500 text-white';

    const greenhouseStatusText =
      activeTemp >= 32 || activeTemp < 12 ? '全開' : activeTemp > 26 ? '換気' : '適温';
    const greenhouseColorClass =
      activeTemp >= 32 || activeTemp < 12
        ? 'bg-red-500 text-white'
        : activeTemp > 26
          ? 'bg-amber-400 text-amber-950'
          : 'bg-emerald-500 text-white';

    const renderThresholdIndicator = (
      tempVal: number,
      label: string,
      colorHex: string,
      isHigh: boolean
    ) => {
      const yPos = getYForTemp(tempVal);
      if (yPos < plotTop + 2 || yPos > plotBottom - 2) return null;

      const bandY = isHigh ? plotTop : yPos;
      const bandH = isHigh ? yPos - plotTop : plotBottom - yPos;

      return (
        <g key={`thresh-${tempVal}`}>
          <rect
            x={paddingLeft - 5}
            y={bandY}
            width={width - paddingLeft - paddingRight + 10}
            height={bandH}
            fill={colorHex}
            opacity="0.06"
            pointerEvents="none"
          />
          <line
            x1={paddingLeft - 8}
            y1={yPos}
            x2={width - paddingRight + 5}
            y2={yPos}
            stroke={colorHex}
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.75"
          />
          <text
            x={width - paddingRight - 4}
            y={isHigh ? yPos - 3 : yPos + 10}
            fill={colorHex}
            fontSize="9"
            fontWeight="bold"
            textAnchor="end"
            opacity="0.9"
          >
            {label}
          </text>
        </g>
      );
    };

    return (
      <div className="space-y-2 pt-1 animate-fade-in">
        <div className="flex items-center justify-between bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-100/80">
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-black text-emerald-950 flex items-center gap-1">
              📈 24時間推移:
            </span>
            <span className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <span className="text-emerald-950 font-black">実測気温</span>
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
              <span className="inline-block w-2.5 h-1 border-t-2 border-dashed border-emerald-400"></span>
              <span className="text-emerald-800 font-bold">予測気温</span>
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[10px]">
            <span className="text-gray-500 font-bold hidden sm:inline">気象精度:</span>
            <span className="bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-full shadow-sm">
              ✨ Open-Meteo 高精度Live
            </span>
            <button
              onClick={() => setShowSourceTooltip(!showSourceTooltip)}
              className="text-gray-400 hover:text-emerald-700 font-bold underline transition"
              title="気象データソースの詳細情報"
            >
              ℹ️ 情報源
            </button>
          </div>
        </div>

        {showSourceTooltip && (
          <div className="bg-slate-900 text-white text-[11px] p-3 rounded-2xl shadow-xl border border-emerald-400 space-y-1 animate-fade-in">
            <p className="font-bold text-amber-300">
              🛰️ 気象データソース ＆ 実測・予測更新ロジック:
            </p>
            <p className="text-gray-300 leading-relaxed">
              本Widgetは Open-Meteo 気象衛星API (GSM/MSM気象モデル)
              から緯度経度ピンポイントの気象データを毎時取得しています。
              <br />・<strong className="text-emerald-400">実測気温</strong>
              : 経過した過去時間の地点観測数値
              <br />・<strong className="text-emerald-400">予測気温</strong>:
              当日未経過および未来時間帯の数値計算モデル予測
            </p>
          </div>
        )}

        {/* 24時間グラフ (全幅・横長配置で見切れと下部余白を解消) */}
        <div className="w-full bg-white p-3 rounded-2xl border border-gray-200/80 shadow-xs relative overflow-hidden">
          <div className="relative w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${svgTotalHeight}`}
              className="w-full h-auto min-w-[650px] overflow-visible"
            >
              {/* 閾値ライン・警戒帯 */}
              {renderThresholdIndicator(32, '⚠️ 猛暑限界 32°C', '#dc2626', true)}
              {renderThresholdIndicator(28, '⚡ 暑さ注意 28°C', '#d97706', true)}
              {renderThresholdIndicator(15, '❄️ 生育低温 15°C', '#2563eb', false)}

              {/* Y軸グリッド線 ＆ 目盛り */}
              <line
                x1={paddingLeft}
                y1={plotTop}
                x2={width - paddingRight}
                y2={plotTop}
                stroke="#e2e8f0"
                strokeWidth="0.8"
              />
              <line
                x1={paddingLeft}
                y1={getYForTemp(midTemp)}
                x2={width - paddingRight}
                y2={getYForTemp(midTemp)}
                stroke="#f1f5f9"
                strokeWidth="0.8"
                strokeDasharray="2 2"
              />
              <line
                x1={paddingLeft}
                y1={plotBottom}
                x2={width - paddingRight}
                y2={plotBottom}
                stroke="#cbd5e1"
                strokeWidth="1"
              />

              <text
                x={paddingLeft - 8}
                y={plotTop + 3}
                fill="#dc2626"
                fontSize="9.5"
                fontWeight="bold"
                textAnchor="end"
              >
                {maxTemp}°C
              </text>
              <text
                x={paddingLeft - 8}
                y={getYForTemp(midTemp) + 3}
                fill="#64748b"
                fontSize="9.5"
                fontWeight="bold"
                textAnchor="end"
              >
                {midTemp}°C
              </text>
              <text
                x={paddingLeft - 8}
                y={plotBottom + 3}
                fill="#475569"
                fontSize="9.5"
                fontWeight="bold"
                textAnchor="end"
              >
                {minTemp}°C
              </text>

              {/* 現在時刻(今)の垂直ラインガイド */}
              {currentP && (
                <g key="current-time-line">
                  <line
                    x1={currentP.x}
                    y1={plotTop - 5}
                    x2={currentP.x}
                    y2={svgTotalHeight - 22}
                    stroke="#059669"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  <rect
                    x={currentP.x - 14}
                    y={plotTop - 12}
                    width="28"
                    height="12"
                    rx="3"
                    fill="#059669"
                  />
                  <text
                    x={currentP.x}
                    y={plotTop - 3}
                    fill="#ffffff"
                    fontSize="8"
                    fontWeight="black"
                    textAnchor="middle"
                  >
                    現在
                  </text>
                </g>
              )}

              {/* 折れ線: 過去の実測ライン */}
              {actualPoints.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#059669"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={actualPolyline}
                />
              )}

              {/* 折れ線: 未来の予測ライン */}
              {futurePoints.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={futurePolyline}
                />
              )}

              {/* 各時間データポイント (24時間) */}
              {points.map((pt) => {
                const isNow = pt.isCurrent;
                const isHovered = hoveredPointInfo && hoveredPointInfo.hourData.hour === pt.hour;
                const displayY = pt.isPast ? pt.yActual : pt.yPredicted;
                const pointColor = pt.isPast ? '#059669' : '#10b981';

                const showTempLabel = pt.hour % 3 === 0 || isNow || isHovered;
                const rectWidth = width / data.length;
                const leftBound = pt.x - rectWidth / 2;

                return (
                  <g
                    key={`pt-${pt.hour}`}
                    className="transition-all duration-150 cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredPointInfo({
                        x: pt.x,
                        y: displayY,
                        hourData: pt.rawData,
                      })
                    }
                    onMouseLeave={() => setHoveredPointInfo(null)}
                  >
                    {/* 1. X軸の時間ラベル */}
                    <text
                      x={pt.x}
                      y={plotBottom + 13}
                      fill={isNow ? '#047857' : pt.isPast ? '#334155' : '#64748b'}
                      fontSize={isNow ? '10' : '9'}
                      fontWeight={isNow ? '900' : pt.hour % 3 === 0 ? 'bold' : 'normal'}
                      textAnchor="middle"
                    >
                      {pt.time}時
                    </text>

                    {/* 2. 天気アイコン */}
                    <text x={pt.x} y={svgTotalHeight - 5} fontSize="10" textAnchor="middle">
                      {getWeatherIcon(pt.rawData.weather)}
                    </text>

                    {/* 3. 気温数字ラベル */}
                    {showTempLabel && (
                      <text
                        x={pt.x}
                        y={displayY - (isNow ? 11 : 8)}
                        fill={isNow ? '#047857' : '#1e293b'}
                        fontSize={isNow ? '11' : '9.5'}
                        fontWeight={isNow ? '900' : 'bold'}
                        textAnchor="middle"
                      >
                        {pt.isPast ? pt.tempActual : pt.tempPredicted}°
                      </text>
                    )}

                    {/* 4. プロット円 */}
                    <circle
                      cx={pt.x}
                      cy={displayY}
                      r={isNow ? '6' : isHovered ? '5' : '3.5'}
                      fill={isNow ? '#059669' : isHovered ? '#047857' : '#ffffff'}
                      stroke={pointColor}
                      strokeWidth={isNow ? '3' : '2'}
                    />

                    {/* 5. 広範囲ヒット領域 */}
                    <rect
                      x={leftBound}
                      y="0"
                      width={rectWidth}
                      height={svgTotalHeight}
                      fill="transparent"
                      className="cursor-pointer"
                    />
                  </g>
                );
              })}

              {/* ホバー時の垂直強調カーソル ＆ ツールチップ */}
              {hoveredPointInfo && (
                <g key="hover-tooltip">
                  <line
                    x1={hoveredPointInfo.x}
                    y1={plotTop - 5}
                    x2={hoveredPointInfo.x}
                    y2={svgTotalHeight - 20}
                    stroke="#0284c7"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />

                  <g
                    transform={`translate(${
                      hoveredPointInfo.x > width - 140
                        ? hoveredPointInfo.x - 130
                        : hoveredPointInfo.x < 130
                          ? hoveredPointInfo.x + 10
                          : hoveredPointInfo.x - 60
                    }, ${Math.max(10, hoveredPointInfo.y - 65)})`}
                  >
                    <rect
                      width="120"
                      height="55"
                      rx="8"
                      fill="#0f172a"
                      opacity="0.95"
                      stroke="#38bdf8"
                      strokeWidth="1"
                    />
                    <text x="8" y="15" fill="#38bdf8" fontSize="10" fontWeight="bold">
                      ⏰ {hoveredPointInfo.hourData.time}:00 のピンポイント
                    </text>
                    <text x="8" y="29" fill="#ffffff" fontSize="9.5" fontWeight="bold">
                      🌡️ 気温:{' '}
                      {hoveredPointInfo.hourData.isPast
                        ? `${hoveredPointInfo.hourData.tempActual}°C (実測)`
                        : `${hoveredPointInfo.hourData.tempPredicted}°C (予測)`}
                    </text>
                    <text x="8" y="42" fill="#94a3b8" fontSize="9">
                      💧 降水:{hoveredPointInfo.hourData.rainProb}% | 💨 風速:
                      {hoveredPointInfo.hourData.wind}m/s
                    </text>
                  </g>
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* 7大リアルタイム農業指標 (グラフ直下に横長配置・無駄な余白ゼロ) */}
        <div className="space-y-2">
          {/* モバイル用開閉トグル */}
          <button
            type="button"
            onClick={() => setShowMobileDetails(!showMobileDetails)}
            className="w-full py-1.5 px-3 bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center justify-between shadow-xs hover:bg-emerald-900 transition md:hidden"
          >
            <span className="flex items-center gap-1.5">
              <span>⏱️</span>
              <span>{displayData.time}:00 ピンポイント気象</span>
            </span>
            <span className="text-[10px] text-emerald-200">
              {showMobileDetails ? '▲ 詳細グラフを閉じる' : '▼ 詳細を開く'}
            </span>
          </button>

          <div
            className={`bg-emerald-50/60 p-2.5 sm:p-3 rounded-2xl border border-emerald-200/70 space-y-2 ${
              showMobileDetails ? 'block' : 'hidden md:block'
            }`}
          >
            <div className="flex justify-between items-center text-[11px] font-black text-emerald-950 px-0.5">
              <span className="flex items-center gap-1.5">
                <span>🎯</span>
                <span>農作業・生理判定 (7大指標)</span>
                <span className="bg-emerald-600 text-white font-bold text-[9px] px-1.5 py-0.2 rounded-md">
                  {displayData.time}:00 ピンポイント気象連動
                </span>
              </span>
              <span className="text-[10px] text-emerald-800 font-bold">
                {displayData.isPast ? displayData.tempActual : displayData.tempPredicted}°C / 💨{' '}
                {displayData.wind}m/s
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 text-xs">
              {/* 1. 防除・液肥散布 */}
              <div className="flex flex-col justify-between items-center bg-white p-2 rounded-xl border border-gray-200/90 shadow-2xs text-center min-h-[52px]">
                <span className="text-[10px] font-bold text-gray-600 truncate flex items-center gap-1">
                  🛡️ 防除・散布
                </span>
                <span
                  className={`w-full font-black text-[10px] py-0.5 rounded text-center tracking-wider ${sprayColorClass}`}
                >
                  {sprayStatusText}
                </span>
              </div>

              {/* 2. 熱ストレス・作業安全 */}
              <div className="flex flex-col justify-between items-center bg-white p-2 rounded-xl border border-gray-200/90 shadow-2xs text-center min-h-[52px]">
                <span className="text-[10px] font-bold text-gray-600 truncate flex items-center gap-1">
                  ☀️ 熱中症
                </span>
                <span
                  className={`w-full font-black text-[10px] py-0.5 rounded text-center tracking-wider ${heatColorClass}`}
                >
                  {heatStatusText}
                </span>
              </div>

              {/* 3. 光合成効率 */}
              <div className="flex flex-col justify-between items-center bg-white p-2 rounded-xl border border-gray-200/90 shadow-2xs text-center min-h-[52px]">
                <span className="text-[10px] font-bold text-gray-600 truncate flex items-center gap-1">
                  🌿 光合成
                </span>
                <span
                  className={`w-full font-black text-[10px] py-0.5 rounded text-center tracking-wider ${photoColorClass}`}
                >
                  {photoStatusText}
                </span>
              </div>

              {/* 4. 蒸散量 */}
              <div className="flex flex-col justify-between items-center bg-white p-2 rounded-xl border border-gray-200/90 shadow-2xs text-center min-h-[52px]">
                <span className="text-[10px] font-bold text-gray-600 truncate flex items-center gap-1">
                  💦 蒸散
                </span>
                <span
                  className={`w-full font-black text-[10px] py-0.5 rounded text-center tracking-wider ${evapTransColorClass}`}
                >
                  {evapTransStatusText}
                </span>
              </div>

              {/* 5. 葉面乾燥指数 */}
              <div className="flex flex-col justify-between items-center bg-white p-2 rounded-xl border border-gray-200/90 shadow-2xs text-center min-h-[52px]">
                <span className="text-[10px] font-bold text-gray-600 truncate flex items-center gap-1">
                  🍃 葉面
                </span>
                <span
                  className={`w-full font-black text-[10px] py-0.5 rounded text-center tracking-wider ${leafWetColorClass}`}
                >
                  {leafWetStatusText}
                </span>
              </div>

              {/* 6. 病害発生リスク */}
              <div className="flex flex-col justify-between items-center bg-white p-2 rounded-xl border border-gray-200/90 shadow-2xs text-center min-h-[52px]">
                <span className="text-[10px] font-bold text-gray-600 truncate flex items-center gap-1">
                  👾 病害
                </span>
                <span
                  className={`w-full font-black text-[10px] py-0.5 rounded text-center tracking-wider ${diseaseRiskColorClass}`}
                >
                  {diseaseRiskStatusText}
                </span>
              </div>

              {/* 7. ハウス・施設制御 */}
              <div className="flex flex-col justify-between items-center bg-white p-2 rounded-xl border border-gray-200/90 shadow-2xs text-center min-h-[52px]">
                <span className="text-[10px] font-bold text-gray-600 truncate flex items-center gap-1">
                  🏠 ハウス
                </span>
                <span
                  className={`w-full font-black text-[10px] py-0.5 rounded text-center tracking-wider ${greenhouseColorClass}`}
                >
                  {greenhouseStatusText}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* 閲覧タブ切り替え: 24時間・今日・1週間 の順番とシンプル表記 */}
      <div className="flex justify-between items-center border-b border-gray-200/80 pb-2 flex-wrap gap-2">
        <div className="flex space-x-1.5 bg-gray-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('24h')}
            className={`px-4 py-1.5 rounded-xl text-xs font-black transition ${
              activeTab === '24h'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            24時間
          </button>
          <button
            onClick={() => setActiveTab('level')}
            className={`px-4 py-1.5 rounded-xl text-xs font-black transition ${
              activeTab === 'level'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            今日
          </button>
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-1.5 rounded-xl text-xs font-black transition ${
              activeTab === 'daily'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            1週間
          </button>
        </div>
      </div>

      {/* 1. 24時間詳細グラフ ＆ 時間単位指標 */}
      {activeTab === '24h' && render24hLineChart()}

      {/* 2. 今日: 日単位 意思決定5大指標 */}
      {activeTab === 'level' && (
        <div className="space-y-2.5 pt-1 animate-fade-in">
          <div className="flex items-center justify-between flex-wrap gap-2 px-1">
            <span className="text-xs font-black text-emerald-950 block">
              📊 今日の農業意思決定 5大指標:
            </span>
            <span className="text-[10px] font-bold text-gray-500">
              <span className="text-emerald-700 font-black">● 安全・最適</span> /{' '}
              <span className="text-amber-600 font-black">● 注意</span> /{' '}
              <span className="text-red-600 font-black">● 警戒・対策</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {/* 1. 🌿 光合成指数 */}
            {(() => {
              const isSafe =
                weather.today.tempMax >= 20 &&
                weather.today.tempMax <= 30 &&
                weather.today.weather === 'sunny';
              const isWarning =
                weather.today.weather === 'rainy' || weather.today.weather === 'storm';
              const label = isWarning ? '低下' : isSafe ? '最大' : '標準';
              const badgeClass = isWarning
                ? 'bg-red-500 text-white'
                : isSafe
                  ? 'bg-emerald-500 text-white'
                  : 'bg-amber-400 text-amber-950';
              return (
                <div className="bg-white p-2.5 rounded-xl border border-gray-200/90 shadow-2xs space-y-1.5 text-center">
                  <div className="text-[11px] font-black text-emerald-950">🌿 光合成</div>
                  <div className={`font-black text-[11px] py-0.5 rounded ${badgeClass}`}>
                    {label}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">日照と気温適性</div>
                </div>
              );
            })()}

            {/* 2. 💧 灌水必要度指数 */}
            {(() => {
              const isSafe = weather.today.rainSum >= 8;
              const isWarning = weather.today.tempMax >= 30 && weather.today.rainSum < 2;
              const label = isWarning ? 'たっぷり給水' : isSafe ? '給水不要' : '標準水やり';
              const badgeClass = isWarning
                ? 'bg-red-500 text-white'
                : isSafe
                  ? 'bg-emerald-500 text-white'
                  : 'bg-amber-400 text-amber-950';
              return (
                <div className="bg-white p-2.5 rounded-xl border border-gray-200/90 shadow-2xs space-y-1.5 text-center">
                  <div className="text-[11px] font-black text-emerald-950">💧 灌水必要度</div>
                  <div className={`font-black text-[11px] py-0.5 rounded ${badgeClass}`}>
                    {label}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">降水と土壌乾燥</div>
                </div>
              );
            })()}

            {/* 3. 💦 蒸散ストレス指数 */}
            {(() => {
              const isWarning = weather.today.tempMax >= 32;
              const isCaution = weather.today.tempMax >= 28;
              const label = isWarning ? '萎れ警戒' : isCaution ? '注意' : '正常';
              const badgeClass = isWarning
                ? 'bg-red-500 text-white'
                : isCaution
                  ? 'bg-amber-400 text-amber-950'
                  : 'bg-emerald-500 text-white';
              return (
                <div className="bg-white p-2.5 rounded-xl border border-gray-200/90 shadow-2xs space-y-1.5 text-center">
                  <div className="text-[11px] font-black text-emerald-950">💦 蒸散ストレス</div>
                  <div className={`font-black text-[11px] py-0.5 rounded ${badgeClass}`}>
                    {label}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">吸水バランス</div>
                </div>
              );
            })()}

            {/* 4. 🛡️ 防除適性指数 */}
            {(() => {
              const isWarning = weather.today.windSpeed > 5 || weather.today.rainSum >= 10;
              const isCaution = weather.today.windSpeed >= 3;
              const label = isWarning ? '散布不可' : isCaution ? '時間帯選定' : '散布可能';
              const badgeClass = isWarning
                ? 'bg-red-500 text-white'
                : isCaution
                  ? 'bg-amber-400 text-amber-950'
                  : 'bg-emerald-500 text-white';
              return (
                <div className="bg-white p-2.5 rounded-xl border border-gray-200/90 shadow-2xs space-y-1.5 text-center">
                  <div className="text-[11px] font-black text-emerald-950">🛡️ 防除適性</div>
                  <div className={`font-black text-[11px] py-0.5 rounded ${badgeClass}`}>
                    {label}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">風速と雨量判定</div>
                </div>
              );
            })()}

            {/* 5. ☀️ 熱ストレス指数 */}
            {(() => {
              const isWarning = weather.today.tempMax >= 32;
              const isCaution = weather.today.tempMax >= 28;
              const label = isWarning ? '屋外中止' : isCaution ? '水分補給' : '快適';
              const badgeClass = isWarning
                ? 'bg-red-500 text-white'
                : isCaution
                  ? 'bg-amber-400 text-amber-950'
                  : 'bg-emerald-500 text-white';
              return (
                <div className="bg-white p-2.5 rounded-xl border border-gray-200/90 shadow-2xs space-y-1.5 text-center">
                  <div className="text-[11px] font-black text-emerald-950">☀️ 熱中症警戒</div>
                  <div className={`font-black text-[11px] py-0.5 rounded ${badgeClass}`}>
                    {label}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">WBGT・安全</div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 3. 1週間: 週間天気予報 (7日間) */}
      {activeTab === 'daily' && (
        <div className="space-y-3 pt-1 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {weather.daily.map((d, i) => (
              <div
                key={i}
                className={`p-2.5 rounded-2xl border text-center space-y-1 transition hover:scale-102 ${
                  d.isToday
                    ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400 shadow-xs'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="text-[11px] font-black text-gray-700">{d.dayLabel}</div>
                <div className="text-xl my-1">{getWeatherIcon(d.weather)}</div>
                <div className="text-[10px] font-bold text-gray-500">
                  {getWeatherText(d.weather)}
                </div>
                <div className="text-xs font-black pt-1">
                  <span className="text-red-500">{d.tempMax}°</span> /{' '}
                  <span className="text-blue-500">{d.tempMin}°</span>
                </div>
                <div className="text-[9.5px] text-cyan-600 font-bold bg-cyan-50 py-0.5 rounded-md">
                  ☔ {d.rainProb}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
