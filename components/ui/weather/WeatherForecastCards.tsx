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
    const height = 115; // 縦の長さを約半分に短縮 (PC1画面収容)
    const paddingLeft = 45;
    const paddingRight = 25;

    const temps = data.map((d) => [d.tempActual, d.tempPredicted]).flat();
    let minTemp = Math.min(...temps) - 2;
    let maxTemp = Math.max(...temps) + 2;
    if (minTemp === maxTemp) {
      minTemp -= 2;
      maxTemp += 2;
    }
    const tempRange = maxTemp - minTemp;
    const midTemp = Math.round((minTemp + maxTemp) / 2);
    const svgTotalHeight = 155; // 総高さ155px (半減)

    const plotTop = 15;
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

    // ▼ 7つの時間単位指標 (Hourly Indicators) 計算
    const sprayStatusText =
      activeWind > 5 || activeRainProb >= 70
        ? '散布中止(強風・雨)'
        : activeWind >= 3
          ? '風注意(漂流注意)'
          : '散布に最適(微風)';
    const sprayColorClass =
      activeWind > 5 || activeRainProb >= 70
        ? 'bg-red-600 text-white font-black border-red-700'
        : activeWind >= 3
          ? 'bg-amber-500 text-gray-950 font-black border-amber-600'
          : 'bg-blue-600 text-white font-black border-blue-700';

    const heatStatusText =
      activeTemp >= 32
        ? '作業中止(極度高温)'
        : activeTemp >= 28
          ? '水分補給(熱中症注意)'
          : '快適(作業適期)';
    const heatColorClass =
      activeTemp >= 32
        ? 'bg-red-600 text-white font-black border-red-700 animate-pulse'
        : activeTemp >= 28
          ? 'bg-amber-500 text-gray-950 font-black border-amber-600'
          : 'bg-blue-600 text-white font-black border-blue-700';

    const photoStatusText =
      activeWeather === 'rainy' || activeWeather === 'storm'
        ? '低下(日照不足)'
        : activeTemp >= 20 && activeTemp <= 30 && activeWeather === 'sunny'
          ? '光合成活発(絶好)'
          : '標準(安定成長)';
    const photoColorClass =
      activeWeather === 'rainy' || activeWeather === 'storm'
        ? 'bg-red-600 text-white font-black border-red-700'
        : activeTemp >= 20 && activeTemp <= 30 && activeWeather === 'sunny'
          ? 'bg-blue-600 text-white font-black border-blue-700'
          : 'bg-amber-500 text-gray-950 font-black border-amber-600';

    const evapTransStatusText =
      activeTemp < 15 || activeWeather === 'rainy'
        ? '蒸散停滞(吸水鈍化)'
        : activeTemp >= 22 && activeWeather === 'sunny'
          ? '蒸散盛ん(吸水良好)'
          : '標準蒸散';
    const evapTransColorClass =
      activeTemp < 15 || activeWeather === 'rainy'
        ? 'bg-red-600 text-white font-black border-red-700'
        : activeTemp >= 22 && activeWeather === 'sunny'
          ? 'bg-blue-600 text-white font-black border-blue-700'
          : 'bg-amber-500 text-gray-950 font-black border-amber-600';

    const leafWetStatusText =
      activeRainSum > 0 || activeRainProb >= 60
        ? '高湿度(病害注視)'
        : activeRainProb >= 30
          ? 'やや湿潤(経過観察)'
          : '葉面乾燥(病原菌抑制)';
    const leafWetColorClass =
      activeRainSum > 0 || activeRainProb >= 60
        ? 'bg-red-600 text-white font-black border-red-700'
        : activeRainProb >= 30
          ? 'bg-amber-500 text-gray-950 font-black border-amber-600'
          : 'bg-blue-600 text-white font-black border-blue-700';

    const diseaseRiskStatusText =
      activeRainSum >= 5 || (activeRainProb >= 60 && activeTemp >= 25)
        ? '高リスク(即防除検討)'
        : activeRainProb >= 40
          ? '湿気注意(予防観察)'
          : '低リスク(発生なし)';
    const diseaseRiskColorClass =
      activeRainSum >= 5 || (activeRainProb >= 60 && activeTemp >= 25)
        ? 'bg-red-600 text-white font-black border-red-700'
        : activeRainProb >= 40
          ? 'bg-amber-500 text-gray-950 font-black border-amber-600'
          : 'bg-blue-600 text-white font-black border-blue-700';

    const greenhouseStatusText =
      activeTemp >= 32 || activeTemp < 12
        ? '遮光・全開換気(高熱)'
        : activeTemp > 26
          ? '天窓オープン(換気推奨)'
          : '換気要らず(快適温度)';
    const greenhouseColorClass =
      activeTemp >= 32 || activeTemp < 12
        ? 'bg-red-600 text-white font-black border-red-700'
        : activeTemp > 26
          ? 'bg-amber-500 text-gray-950 font-black border-amber-600'
          : 'bg-blue-600 text-white font-black border-blue-700';

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

        {/* 24時間グラフ ＆ 詳細カードレスポンシブコンテナ */}
        <div className="w-full flex-col md:flex-row items-stretch gap-3 flex">
          <div className="flex-1 bg-white p-3 rounded-2xl border border-gray-200/80 shadow-xs relative overflow-hidden">
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

          {/* 右側 / スマホ詳細展開: 選択中時間の詳細 ＆ リアルタイム農業意思決定指標 */}
          <div className="md:w-80 w-full space-y-2">
            <button
              type="button"
              onClick={() => setShowMobileDetails(!showMobileDetails)}
              className="w-full py-1.5 px-3 bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center justify-between shadow-xs hover:bg-emerald-900 transition md:hidden"
            >
              <span className="flex items-center gap-1.5">
                <span>⏱️</span>
                <span>{displayData.time}:00 農業判断指標</span>
                <span className="bg-emerald-600 text-[10px] px-1.5 py-0.2 rounded text-emerald-100 font-normal">
                  {hoveredPointInfo ? 'グラフ選択中' : '現在時刻'}
                </span>
              </span>
              <span className="text-[10px] text-emerald-300">
                {showMobileDetails ? '▲ 詳細グラフを閉じる' : '▼ タップして詳細開く'}
              </span>
            </button>

            <div
              className={`space-y-2 transition-all duration-200 ${
                showMobileDetails ? 'block' : 'hidden md:block'
              }`}
            >
              {/* 基本気象カード */}
              <div className="bg-slate-900 text-white p-3 rounded-2xl border border-slate-700 shadow-sm space-y-2">
                <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-emerald-400 font-extrabold text-xs">
                      ⏱️ {displayData.time}:00 のピンポイント気象
                    </span>
                    {hoveredPointInfo ? (
                      <span className="bg-amber-500 text-gray-950 font-black text-[9px] px-1.5 py-0.5 rounded">
                        グラフ選択中
                      </span>
                    ) : (
                      <span className="bg-emerald-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded">
                        リアルタイム
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-gray-300">
                    {getWeatherIcon(displayData.weather)} {getWeatherText(displayData.weather)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1 text-center pt-0.5">
                  <div className="bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
                    <span className="text-[9px] text-gray-400 block font-bold">気温</span>
                    <span className="text-sm font-black text-amber-300">
                      {displayData.isPast ? displayData.tempActual : displayData.tempPredicted}
                      °C
                    </span>
                  </div>

                  <div className="bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
                    <span className="text-[9px] text-gray-400 block font-bold">降水確率</span>
                    <span className="text-sm font-black text-cyan-300">
                      {displayData.rainProb}%
                    </span>
                  </div>

                  <div className="bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
                    <span className="text-[9px] text-gray-400 block font-bold">1h降水量</span>
                    <span className="text-sm font-black text-blue-300">{displayData.rain}mm</span>
                  </div>

                  <div className="bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
                    <span className="text-[9px] text-gray-400 block font-bold">風速</span>
                    <span className="text-sm font-black text-emerald-300">
                      {displayData.wind}m/s
                    </span>
                  </div>
                </div>
              </div>

              {/* 時間連動: 7大リアルタイム農業指標 (日本語判定バッジ) */}
              <div className="bg-emerald-900/10 p-3 rounded-2xl border border-emerald-200/80 space-y-1.5">
                <div className="flex justify-between items-center pb-1 border-b border-emerald-200/60">
                  <span className="text-[11px] font-black text-emerald-950 flex items-center gap-1">
                    🎯 {displayData.time}:00 農作業・生理判定 (7大指標)
                  </span>
                  <span className="text-[9px] text-emerald-800 font-bold">時間連動型</span>
                </div>

                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  {/* 1. 防除・液肥散布 */}
                  <div className="flex items-center justify-between bg-white p-1.5 rounded-xl border border-gray-200 shadow-2xs group relative cursor-help">
                    <span className="text-[9.5px] font-bold text-gray-700 flex items-center gap-1">
                      🛡️ 防除・散布
                    </span>
                    <span
                      className={`font-black text-[9.5px] px-2 py-0.5 rounded-md border ${sprayColorClass}`}
                    >
                      {sprayStatusText}
                    </span>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-52 p-2 bg-gray-900/95 text-white text-[10px] rounded-xl shadow-2xl border border-emerald-400 z-50 font-normal leading-relaxed pointer-events-none animate-fade-in">
                      <div className="font-black text-amber-300 border-b border-gray-700 pb-0.5 mb-1 text-[10.5px]">
                        🛡️ 防除・散布適性
                      </div>
                      風速3m/s以下かつ降雨確率30%未満が最適条件。風速5m/s超または雨天時は薬剤飛散(ドリフト)および流亡のため散布厳禁。
                    </div>
                  </div>

                  {/* 2. 熱ストレス・作業安全 */}
                  <div className="flex items-center justify-between bg-white p-1.5 rounded-xl border border-gray-200 shadow-2xs group relative cursor-help">
                    <span className="text-[9.5px] font-bold text-gray-700 flex items-center gap-1">
                      ☀️ 作業熱ストレス
                    </span>
                    <span
                      className={`font-black text-[9.5px] px-2 py-0.5 rounded-md border ${heatColorClass}`}
                    >
                      {heatStatusText}
                    </span>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-52 p-2 bg-gray-900/95 text-white text-[10px] rounded-xl shadow-2xl border border-red-400 z-50 font-normal leading-relaxed pointer-events-none animate-fade-in">
                      <div className="font-black text-amber-300 border-b border-gray-700 pb-0.5 mb-1 text-[10.5px]">
                        ☀️ 熱ストレス・作業安全
                      </div>
                      WBGT相当指標。28℃以上で熱中症厳重警戒、32℃以上で屋外連続作業停止を推奨。
                    </div>
                  </div>

                  {/* 3. 光合成効率 */}
                  <div className="flex items-center justify-between bg-white p-1.5 rounded-xl border border-gray-200 shadow-2xs group relative cursor-help">
                    <span className="text-[9.5px] font-bold text-gray-700 flex items-center gap-1">
                      🌿 光合成効率
                    </span>
                    <span
                      className={`font-black text-[9.5px] px-2 py-0.5 rounded-md border ${photoColorClass}`}
                    >
                      {photoStatusText}
                    </span>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-52 p-2 bg-gray-900/95 text-white text-[10px] rounded-xl shadow-2xl border border-amber-400 z-50 font-normal leading-relaxed pointer-events-none animate-fade-in">
                      <div className="font-black text-amber-300 border-b border-gray-700 pb-0.5 mb-1 text-[10.5px]">
                        🌿 光合成効率
                      </div>
                      気温20〜30℃＋日照で最大化。日中の二酸化炭素(CO2)施用や光量維持の基準。
                    </div>
                  </div>

                  {/* 4. 蒸散量 */}
                  <div className="flex items-center justify-between bg-white p-1.5 rounded-xl border border-gray-200 shadow-2xs group relative cursor-help">
                    <span className="text-[9.5px] font-bold text-gray-700 flex items-center gap-1">
                      💦 蒸散スピード
                    </span>
                    <span
                      className={`font-black text-[9.5px] px-2 py-0.5 rounded-md border ${evapTransColorClass}`}
                    >
                      {evapTransStatusText}
                    </span>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-52 p-2 bg-gray-900/95 text-white text-[10px] rounded-xl shadow-2xl border border-blue-400 z-50 font-normal leading-relaxed pointer-events-none animate-fade-in">
                      <div className="font-black text-amber-300 border-b border-gray-700 pb-0.5 mb-1 text-[10.5px]">
                        💦 蒸散スピード
                      </div>
                      作物の水汲み上げ能力。蒸散が盛んな時間帯に培地・土壌の十分な水分保持が必要です。
                    </div>
                  </div>

                  {/* 5. 葉面乾燥指数 */}
                  <div className="flex items-center justify-between bg-white p-1.5 rounded-xl border border-gray-200 shadow-2xs group relative cursor-help">
                    <span className="text-[9.5px] font-bold text-gray-700 flex items-center gap-1">
                      🍃 葉面乾燥
                    </span>
                    <span
                      className={`font-black text-[9.5px] px-2 py-0.5 rounded-md border ${leafWetColorClass}`}
                    >
                      {leafWetStatusText}
                    </span>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-52 p-2 bg-gray-900/95 text-white text-[10px] rounded-xl shadow-2xl border border-teal-400 z-50 font-normal leading-relaxed pointer-events-none animate-fade-in">
                      <div className="font-black text-amber-300 border-b border-gray-700 pb-0.5 mb-1 text-[10.5px]">
                        🍃 葉面乾燥指数
                      </div>
                      葉面の濡れ時間と乾燥スピード。結露や降雨後の乾燥を追跡し、糸状菌や細菌病の発生を防ぎます。
                    </div>
                  </div>

                  {/* 6. 病害発生リスク */}
                  <div className="flex items-center justify-between bg-white p-1.5 rounded-xl border border-gray-200 shadow-2xs group relative cursor-help">
                    <span className="text-[9.5px] font-bold text-gray-700 flex items-center gap-1">
                      👾 病害発生危険度
                    </span>
                    <span
                      className={`font-black text-[9.5px] px-2 py-0.5 rounded-md border ${diseaseRiskColorClass}`}
                    >
                      {diseaseRiskStatusText}
                    </span>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-52 p-2 bg-gray-900/95 text-white text-[10px] rounded-xl shadow-2xl border border-purple-400 z-50 font-normal leading-relaxed pointer-events-none animate-fade-in">
                      <div className="font-black text-amber-300 border-b border-gray-700 pb-0.5 mb-1 text-[10.5px]">
                        👾 病害発生危険度
                      </div>
                      高温多湿環境でのべと病・疫病・うどんこ病の胞子飛散危険度を評価。
                    </div>
                  </div>

                  {/* 7. ハウス・施設制御 */}
                  <div className="flex items-center justify-between bg-white p-1.5 rounded-xl border border-gray-200 shadow-2xs group relative cursor-help">
                    <span className="text-[9.5px] font-bold text-gray-700 flex items-center gap-1">
                      🏠 ハウス環境制御
                    </span>
                    <span
                      className={`font-black text-[9.5px] px-2 py-0.5 rounded-md border ${greenhouseColorClass}`}
                    >
                      {greenhouseStatusText}
                    </span>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-52 p-2 bg-gray-900/95 text-white text-[10px] rounded-xl shadow-2xl border border-indigo-400 z-50 font-normal leading-relaxed pointer-events-none animate-fade-in">
                      <div className="font-black text-amber-300 border-b border-gray-700 pb-0.5 mb-1 text-[10.5px]">
                        🏠 ハウス環境制御
                      </div>
                      施設園芸・ビニールハウスの天窓・側窓の開閉および遮光カーテンの動作指針。
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* 閲覧タブ切り替え */}
      <div className="flex justify-between items-center border-b border-gray-200/80 pb-2 flex-wrap gap-2">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('24h')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
              activeTab === '24h'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📈 24時間推移・リアルタイム指標
          </button>
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
              activeTab === 'daily'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📅 週間予報 (7日間)
          </button>
          <button
            onClick={() => setActiveTab('level')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
              activeTab === 'level'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📊 日単位 意思決定5大指標
          </button>
        </div>
      </div>

      {/* 1. 24時間詳細グラフ ＆ 時間単位指標 */}
      {activeTab === '24h' && render24hLineChart()}

      {/* 2. 週間天気予報 (7日間) */}
      {activeTab === 'daily' && (
        <div className="space-y-3 pt-2 animate-fade-in">
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

      {/* 3. 日単位 意思決定5大指標 */}
      {activeTab === 'level' && (
        <div className="space-y-3 pt-2 relative z-10 animate-fade-in border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 pb-2">
            <span className="text-xs font-black text-emerald-950 block">
              📊 日単位 農業意思決定指標 (5大重要指標):
            </span>
            <span className="text-[10px] font-bold text-gray-500">
              判定水準: <span className="text-blue-600 font-black">青＝安全・最適</span> |{' '}
              <span className="text-amber-600 font-black">黄＝注意・経過観察</span> |{' '}
              <span className="text-red-600 font-black">赤＝警戒・即対策</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* 1. 🌿 光合成指数 */}
            {(() => {
              const isSafe =
                weather.today.tempMax >= 20 &&
                weather.today.tempMax <= 30 &&
                weather.today.weather === 'sunny';
              const isWarning =
                weather.today.weather === 'rainy' || weather.today.weather === 'storm';
              const label = isWarning
                ? '光合成低下(日照不足)'
                : isSafe
                  ? '光合成最大(栄養蓄積絶好)'
                  : '標準光合成(安定成長)';
              const badgeClass = isWarning
                ? 'bg-red-600 text-white'
                : isSafe
                  ? 'bg-blue-600 text-white'
                  : 'bg-amber-500 text-gray-950';
              return (
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2 relative group cursor-help transition hover:bg-gray-100">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-emerald-950 flex items-center gap-1.5 font-black">
                      🌿 光合成指数
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${badgeClass}`}>
                      {label}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium leading-tight">
                    日照量と適正温度(20~30℃)から本日の作物栄養蓄積能力を評価
                  </p>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-gray-900 text-white text-[10px] p-3 rounded-xl shadow-2xl border border-emerald-400 z-30 font-bold leading-relaxed pointer-events-none animate-fade-in">
                    💡 晴天かつ20〜30℃で糖分蓄積が最大化。日照不足時は加温・養液管理調整を推奨。
                  </div>
                </div>
              );
            })()}

            {/* 2. 💧 灌水必要度指数 */}
            {(() => {
              const isSafe = weather.today.rainSum >= 8;
              const isWarning = weather.today.tempMax >= 30 && weather.today.rainSum < 2;
              const label = isWarning
                ? 'たっぷり給水(高温乾燥)'
                : isSafe
                  ? '水やり不要(十分な降雨)'
                  : '標準水やり(朝夕給水)';
              const badgeClass = isWarning
                ? 'bg-red-600 text-white'
                : isSafe
                  ? 'bg-blue-600 text-white'
                  : 'bg-amber-500 text-gray-950';
              return (
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2 relative group cursor-help transition hover:bg-gray-100">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-blue-950 flex items-center gap-1.5 font-black">
                      💧 灌水必要度指数
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${badgeClass}`}>
                      {label}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium leading-tight">
                    本日の予想降水量と蒸発散量から最適な水やり量を自動判定
                  </p>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-gray-900 text-white text-[10px] p-3 rounded-xl shadow-2xl border border-blue-400 z-30 font-bold leading-relaxed pointer-events-none animate-fade-in">
                    💡
                    気温30℃超＋少雨時は土壌乾燥に注意。根腐れ防止のため早朝または夕方の灌水を推奨。
                  </div>
                </div>
              );
            })()}

            {/* 3. 💦 蒸散ストレス指数 */}
            {(() => {
              const isWarning = weather.today.tempMax >= 32;
              const isCaution = weather.today.tempMax >= 28;
              const label = isWarning
                ? '萎れ警戒(即散水検討)'
                : isCaution
                  ? '水ストレス注意'
                  : '蒸散正常(吸水良好)';
              const badgeClass = isWarning
                ? 'bg-red-600 text-white'
                : isCaution
                  ? 'bg-amber-500 text-gray-950'
                  : 'bg-blue-600 text-white';
              return (
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2 relative group cursor-help transition hover:bg-gray-100">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-cyan-950 flex items-center gap-1.5 font-black">
                      💦 蒸散ストレス
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${badgeClass}`}>
                      {label}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium leading-tight">
                    作物の水分蒸散スピードと根からの吸水バランスの過剰ストレスを検知
                  </p>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-gray-900 text-white text-[10px] p-3 rounded-xl shadow-2xl border border-cyan-400 z-30 font-bold leading-relaxed pointer-events-none animate-fade-in">
                    💡
                    蒸散過多時は葉の気孔が閉じて成長が停止します。葉面散布や日よけシートでストレス緩和。
                  </div>
                </div>
              );
            })()}

            {/* 4. 🛡️ 防除適性指数 */}
            {(() => {
              const isWarning = weather.today.windSpeed > 5 || weather.today.rainSum >= 10;
              const isCaution = weather.today.windSpeed >= 3;
              const label = isWarning
                ? '終日散布不可(強風・雨)'
                : isCaution
                  ? '時間帯を選んで散布'
                  : '終日散布可能(穏やかな風)';
              const badgeClass = isWarning
                ? 'bg-red-600 text-white'
                : isCaution
                  ? 'bg-amber-500 text-gray-950'
                  : 'bg-blue-600 text-white';
              return (
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2 relative group cursor-help transition hover:bg-gray-100">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-emerald-950 flex items-center gap-1.5 font-black">
                      🛡️ 防除適性指数
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${badgeClass}`}>
                      {label}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium leading-tight">
                    1日の平均風速・雨量から農薬漂流(ドリフト)・流亡リスクを総合評価
                  </p>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-gray-900 text-white text-[10px] p-3 rounded-xl shadow-2xl border border-amber-400 z-30 font-bold leading-relaxed pointer-events-none animate-fade-in">
                    💡
                    風速3m/s未満の早朝時間帯がベスト。風速5m/s超または降雨時は薬害・流亡のため散布厳禁。
                  </div>
                </div>
              );
            })()}

            {/* 5. ☀️ 熱ストレス指数 */}
            {(() => {
              const isWarning = weather.today.tempMax >= 32;
              const isCaution = weather.today.tempMax >= 28;
              const label = isWarning
                ? '日中屋外作業禁止(厳重警戒)'
                : isCaution
                  ? '定時休憩・水分補給'
                  : '現場作業安全(快適)';
              const badgeClass = isWarning
                ? 'bg-red-600 text-white animate-pulse'
                : isCaution
                  ? 'bg-amber-500 text-gray-950'
                  : 'bg-blue-600 text-white';
              return (
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2 relative group cursor-help transition hover:bg-gray-100">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-red-950 flex items-center gap-1.5 font-black">
                      ☀️ 熱ストレス指数
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${badgeClass}`}>
                      {label}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium leading-tight">
                    作業者の熱中症リスク(WBGT相当)および作物の高温障害発生危険度
                  </p>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-slate-950 text-white text-[10px] p-3 rounded-xl shadow-2xl border border-red-500 z-30 font-bold leading-relaxed pointer-events-none animate-fade-in">
                    💡
                    気温32℃以上は熱中症・高温障害の危険度が極めて高まります。10〜15時の屋外農作業を避けてください。
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="bg-emerald-50/80 px-3 py-2 rounded-xl border border-emerald-200 text-xs flex items-center space-x-2 text-emerald-950">
            <span className="text-base">💡</span>
            <span className="font-extrabold leading-tight">
              【農作業アドバイス】本日の主要指標に基づき、適切な防除・給水・作業計画を立てましょう。
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
