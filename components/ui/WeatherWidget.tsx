"use client";

import { useState } from "react";

export type WeatherData = {
  location: string;
  today: {
    weather: "sunny" | "cloudy" | "rainy" | "storm";
    tempMax: number;
    tempMin: number;
    rainProb: number;
    windSpeed: number;
  };
  tomorrow: {
    weather: "sunny" | "cloudy" | "rainy" | "storm";
    tempMax: number;
    tempMin: number;
    rainProb: number;
  };
  advice: string;
};

export default function WeatherWidget() {
  const [weather] = useState<WeatherData>({
    location: "たなか自然農園 (千葉県)",
    today: {
      weather: "rainy",
      tempMax: 26,
      tempMin: 20,
      rainProb: 80,
      windSpeed: 4,
    },
    tomorrow: {
      weather: "sunny",
      tempMax: 29,
      tempMin: 21,
      rainProb: 10,
    },
    advice: "☔ 本日は午後からまとまった雨が予想されます。畝間の排水溝のつまりを事前にチェックしておきましょう！",
  });

  const getWeatherIcon = (type: string) => {
    switch (type) {
      case "sunny": return "☀️";
      case "cloudy": return "☁️";
      case "rainy": return "🌧️";
      case "storm": return "🌩️";
      default: return "☀️";
    }
  };

  const getWeatherText = (type: string) => {
    switch (type) {
      case "sunny": return "晴れ";
      case "cloudy": return "曇り";
      case "rainy": return "雨";
      case "storm": return "荒天";
      default: return "晴れ";
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-5 shadow-lg space-y-3 relative overflow-hidden transition-all border border-blue-800/50">
      {/* 背景装飾 */}
      <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 backdrop-blur-3xl rounded-l-full pointer-events-none"></div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        
        {/* 左側: 位置 ＆ 本日の天気 */}
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-3xl shadow-inner">
            {getWeatherIcon(weather.today.weather)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full border border-blue-400/30 font-bold">
                📍 {weather.location}
              </span>
              <span className="text-xs text-blue-200 font-bold">ピンポイント農園気象</span>
            </div>
            <div className="flex items-baseline space-x-2 mt-0.5">
              <span className="text-xl font-black">{getWeatherText(weather.today.weather)}</span>
              <span className="text-base font-bold text-amber-300">{weather.today.tempMax}°C</span>
              <span className="text-xs text-blue-200">/ {weather.today.tempMin}°C</span>
              <span className="text-xs font-bold bg-blue-500/40 text-blue-100 px-2 py-0.5 rounded-md">
                ☔ {weather.today.rainProb}%
              </span>
            </div>
          </div>
        </div>

        {/* 明日の天気簡易予報 */}
        <div className="flex items-center space-x-3 bg-white/10 p-2.5 rounded-2xl border border-white/10 text-xs shrink-0">
          <div className="text-center">
            <span className="text-[10px] text-blue-200 font-bold block">明日</span>
            <span className="text-lg">{getWeatherIcon(weather.tomorrow.weather)}</span>
          </div>
          <div>
            <span className="font-bold block text-blue-100">{getWeatherText(weather.tomorrow.weather)}</span>
            <span className="text-[11px] text-amber-300 font-bold">{weather.tomorrow.tempMax}°C</span>
          </div>
        </div>

      </div>

      {/* 気象連動自動アドバイス */}
      <div className="bg-white/10 p-3 rounded-2xl border border-white/10 text-xs text-blue-100 flex items-start space-x-2 relative z-10">
        <span className="text-base leading-none">💡</span>
        <p className="leading-relaxed font-medium">{weather.advice}</p>
      </div>
    </div>
  );
}
