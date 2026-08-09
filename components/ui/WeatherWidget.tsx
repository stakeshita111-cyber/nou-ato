"use client";

import { useEffect, useState } from "react";

export type WeatherData = {
  location: string;
  lat: number;
  lon: number;
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

// 選択可能な主要農業エリアプリセット
const PRESET_LOCATIONS = [
  { name: "テスト農園 (千葉県千葉市)", lat: 35.6074, lon: 140.1065 },
  { name: "東京都 八王子市農場", lat: 35.6554, lon: 139.3239 },
  { name: "神奈川県 相模原農園", lat: 35.5714, lon: 139.3711 },
  { name: "埼玉県 さいたま市農園", lat: 35.8617, lon: 139.6455 },
  { name: "茨城県 つくば農業拠点", lat: 36.0835, lon: 140.0764 },
  { name: "静岡県 浜松農園", lat: 34.7108, lon: 137.7261 },
  { name: "長野県 松本農地", lat: 36.238, lon: 137.9719 },
  { name: "愛知県 豊橋農業区", lat: 34.7694, lon: 137.3915 },
  { name: "兵庫県 淡路島体験農園", lat: 34.4293, lon: 134.8016 },
  { name: "福岡県 糸島農園", lat: 33.5594, lon: 130.1972 },
];

export default function WeatherWidget() {
  const [locationName, setLocationName] = useState<string>("テスト農園 (千葉県千葉市)");
  const [lat, setLat] = useState<number>(35.6074);
  const [lon, setLon] = useState<number>(140.1065);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [weather, setWeather] = useState<WeatherData>({
    location: "テスト農園 (千葉県千葉市)",
    lat: 35.6074,
    lon: 140.1065,
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
    advice: "☔ 本日は雨が予想されます。畝間の排水溝チェックとハウスの換気管理を実施しましょう！",
  });

  // 保存設定のロード & Open-Meteo API からリアルタイム気象データを取得
  useEffect(() => {
    const savedLoc = localStorage.getItem("nouato_weather_location");
    const savedLat = localStorage.getItem("nouato_weather_lat");
    const savedLon = localStorage.getItem("nouato_weather_lon");

    let currentLat = lat;
    let currentLon = lon;
    let currentName = locationName;

    if (savedLoc) {
      currentName = savedLoc;
      setLocationName(savedLoc);
    }
    if (savedLat && savedLon) {
      currentLat = parseFloat(savedLat);
      currentLon = parseFloat(savedLon);
      setLat(currentLat);
      setLon(currentLon);
    }

    fetchLiveWeather(currentName, currentLat, currentLon);
  }, []);

  // Open-Meteo API からリアルタイム天気予報を取得
  const fetchLiveWeather = async (locName: string, latitude: number, longitude: number) => {
    setLoading(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max&timezone=Asia%2FTokyo`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const daily = data.daily;

        if (daily && daily.weathercode) {
          const todayCode = daily.weathercode[0];
          const tomorrowCode = daily.weathercode[1];

          const todayWeather = parseWeatherCode(todayCode);
          const tomorrowWeather = parseWeatherCode(tomorrowCode);

          const todayRainProb = daily.precipitation_probability_max[0] ?? 50;
          const todayTempMax = Math.round(daily.temperature_2m_max[0] ?? 25);
          const todayTempMin = Math.round(daily.temperature_2m_min[0] ?? 18);
          const todayWind = Math.round(daily.windspeed_10m_max[0] ?? 3);

          const tomorrowTempMax = Math.round(daily.temperature_2m_max[1] ?? 26);
          const tomorrowTempMin = Math.round(daily.temperature_2m_min[1] ?? 19);
          const tomorrowRainProb = daily.precipitation_probability_max[1] ?? 20;

          // 気象連動型農作業自動アドバイス算出
          let adviceText = "🌱 本日は絶好の農作業日和です！土壌の水分を観察しながら追肥や収穫作業を進めましょう。";
          if (todayRainProb >= 60 || todayWeather === "rainy") {
            adviceText = "☔ まとまった雨が予想されます。畝間の排水溝のつまりチェックと病害予防のハウス換気を実施してください。";
          } else if (todayTempMax >= 30) {
            adviceText = "☀️ 高温注意報！日中の熱中症に十分注意し、早朝または夕方に水分補給と散水作業を行いましょう。";
          } else if (todayWind >= 7) {
            adviceText = "💨 強風が予想されます！防虫ネットや資材支柱のバタつき固定、ビニールハウスの締め忘れを確認してください。";
          } else if (todayTempMin <= 5) {
            adviceText = "❄️ 低温・霜注意！保温マルチや不織布べたがけで寒さから作物苗を保護しましょう。";
          }

          setWeather({
            location: locName,
            lat: latitude,
            lon: longitude,
            today: {
              weather: todayWeather,
              tempMax: todayTempMax,
              tempMin: todayTempMin,
              rainProb: todayRainProb,
              windSpeed: todayWind,
            },
            tomorrow: {
              weather: tomorrowWeather,
              tempMax: tomorrowTempMax,
              tempMin: tomorrowTempMin,
              rainProb: tomorrowRainProb,
            },
            advice: adviceText,
          });
        }
      }
    } catch (err) {
      console.error("Live weather fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Open-Meteo Weather Code パース
  const parseWeatherCode = (code: number): "sunny" | "cloudy" | "rainy" | "storm" => {
    if (code === 0 || code === 1) return "sunny";
    if (code === 2 || code === 3) return "cloudy";
    if (code >= 51 && code <= 67) return "rainy";
    if (code >= 80 && code <= 82) return "rainy";
    if (code >= 95) return "storm";
    return "cloudy";
  };

  // 地域変更の保存処理
  const handleSelectLocation = (loc: { name: string; lat: number; lon: number }) => {
    setLocationName(loc.name);
    setLat(loc.lat);
    setLon(loc.lon);

    localStorage.setItem("nouato_weather_location", loc.name);
    localStorage.setItem("nouato_weather_lat", loc.lat.toString());
    localStorage.setItem("nouato_weather_lon", loc.lon.toString());

    fetchLiveWeather(loc.name, loc.lat, loc.lon);
    setIsSettingsOpen(false);
  };

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
    <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 shadow-lg space-y-3 relative overflow-hidden transition-all border border-blue-800/50 font-sans">
      {/* 背景光飾 */}
      <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 backdrop-blur-3xl rounded-l-full pointer-events-none"></div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        
        {/* 左側: 位置 ＆ 本日のリアルタイム天気 */}
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-3xl shadow-inner shrink-0">
            {loading ? <span className="animate-spin text-xl">🌀</span> : getWeatherIcon(weather.today.weather)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] bg-blue-500/30 text-blue-200 px-2.5 py-0.5 rounded-full border border-blue-400/30 font-bold flex items-center gap-1">
                📍 {weather.location}
              </span>
              <span className="text-xs text-blue-200 font-bold">リアルタイムピンポイント気象</span>
            </div>
            <div className="flex items-baseline space-x-2 mt-0.5">
              <span className="text-xl font-black">{getWeatherText(weather.today.weather)}</span>
              <span className="text-base font-bold text-amber-300">{weather.today.tempMax}°C</span>
              <span className="text-xs text-blue-200">/ {weather.today.tempMin}°C</span>
              <span className="text-xs font-bold bg-blue-500/40 text-blue-100 px-2 py-0.5 rounded-md">
                ☔ 降水 {weather.today.rainProb}%
              </span>
              <span className="text-[11px] text-gray-300 font-medium hidden sm:inline">
                💨 {weather.today.windSpeed}m/s
              </span>
            </div>
          </div>
        </div>

        {/* 右側: 明日の予報 ＆ ⚙️ 地域設定ボタン */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex items-center space-x-3 bg-white/10 p-2.5 rounded-2xl border border-white/10 text-xs">
            <div className="text-center">
              <span className="text-[10px] text-blue-200 font-bold block">明日</span>
              <span className="text-lg">{getWeatherIcon(weather.tomorrow.weather)}</span>
            </div>
            <div>
              <span className="font-bold block text-blue-100">{getWeatherText(weather.tomorrow.weather)}</span>
              <span className="text-[11px] text-amber-300 font-bold">{weather.tomorrow.tempMax}°C</span>
            </div>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 bg-white/15 hover:bg-white/25 rounded-2xl border border-white/20 text-white font-bold text-xs transition flex items-center gap-1 shadow-xs"
            title="農園の気象地域を設定"
          >
            ⚙️ 地域設定
          </button>
        </div>

      </div>

      {/* 気象連動自動農作業アドバイス */}
      <div className="bg-white/10 p-3 rounded-2xl border border-white/10 text-xs text-blue-100 flex items-start space-x-2 relative z-10">
        <span className="text-base leading-none">💡</span>
        <p className="leading-relaxed font-medium">{weather.advice}</p>
      </div>

      {/* ⚙️ 気象地域設定モーダル ⚙️ */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4 border border-gray-100">
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 transition"
            >
              ✕
            </button>

            <div>
              <span className="inline-block bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-1">
                気象連動設定
              </span>
              <h3 className="text-lg font-black text-gray-900">📍 農園の所在地・エリア設定</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                ご自身の農園の場所を選択すると、ピンポイントのリアルタイム気象データと連動アドバイスが自動更新されます。
              </p>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              <label className="block text-xs font-bold text-gray-700">
                地域プリセットから選択:
              </label>
              {PRESET_LOCATIONS.map((loc, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectLocation(loc)}
                  className={`w-full text-left px-4 py-3 rounded-2xl border font-bold text-xs transition flex items-center justify-between ${
                    locationName === loc.name
                      ? "bg-blue-50 border-blue-600 text-blue-900 shadow-xs"
                      : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span>📍 {loc.name}</span>
                  {locationName === loc.name && <span className="text-blue-600">✓ 選択中</span>}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsSettingsOpen(false)}
              className="w-full py-3 bg-gray-900 text-white font-bold text-xs rounded-xl hover:bg-gray-800 transition"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
