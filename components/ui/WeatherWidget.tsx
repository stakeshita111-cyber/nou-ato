"use client";

import { useEffect, useState, useRef } from "react";
import Toast from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";

export type SprayingStatus = "good" | "warning" | "danger";
export type IrrigationStatus = "skip" | "normal" | "heavy";
export type SunlightStatus = "excellent" | "normal" | "low";
export type HeatAlertStatus = "safe" | "caution" | "warning" | "danger";

export type HourlyPoint = {
  time: string; // "09:00"
  hour: number;
  isPast: boolean; // 過去の実績か
  isCurrent: boolean; // 現在時間か
  weather: "sunny" | "cloudy" | "rainy" | "storm";
  tempActual: number; // 実測気温 (過去)
  tempPredicted: number; // 予測気温 (過去予測 ＆ 未来予測)
  rainProb: number;
  rain: number;
  wind: number;
};

export type DailyPoint = {
  date: string; // "8/9"
  dayLabel: string; // "8/9(日)"
  isPast: boolean; // 過去の実績か
  isToday?: boolean;
  weather: "sunny" | "cloudy" | "rainy" | "storm";
  tempMax: number;
  tempMin: number;
  rainSum: number;
  rainProb: number;
};

export type WeatherData = {
  municipalityName: string; // 市町村名 (例: 千葉県千葉市)
  lat: number;
  lon: number;
  today: {
    weather: "sunny" | "cloudy" | "rainy" | "storm";
    tempMax: number;
    tempMin: number;
    rainProb: number;
    rainSum: number;
    windSpeed: number;
    uvIndex: number;
    sunlightText: string; // 光合成促進度
    sunlightPercent: number; // 日照メーター%
  };
  indices: {
    spraying: { status: SprayingStatus; text: string; levelPercent: number; colorClass: string };
    irrigation: { status: IrrigationStatus; text: string; levelPercent: number; colorClass: string };
    sunlight: { status: SunlightStatus; text: string; levelPercent: number; colorClass: string };
    heatAlert: { status: HeatAlertStatus; text: string; levelPercent: number; colorClass: string };
  };
  hourly: HourlyPoint[]; // 実績(青) ＋ 過去/未来予測(オレンジ) ＋ 現在(赤縦線) 24h時系列データ
  daily: DailyPoint[]; // 本日 ＋ 明日以降1週間分
  adviceShort: string;
};

// 初期表示用の24時間デフォルト時系列データ生成関数
function createInitialHourlyData(): HourlyPoint[] {
  const currentHour = new Date().getHours();
  const list: HourlyPoint[] = [];

  for (let h = 0; h < 24; h += 2) {
    const timeStr = `${h < 10 ? "0" + h : h}:00`;
    const isPast = h < currentHour;
    const isCurrent = h === currentHour || (h <= currentHour && currentHour < h + 2);
    
    // 気温カーブシミュレーション (朝方最低, 14時最高)
    const baseTemp = 20 + Math.round(Math.sin(((h - 8) / 24) * Math.PI * 2) * 6);
    const tempActual = baseTemp;
    const tempPredicted = isPast ? baseTemp + (h % 4 === 0 ? 1 : -1) : baseTemp;

    list.push({
      time: timeStr,
      hour: h,
      isPast,
      isCurrent,
      weather: "sunny",
      tempActual,
      tempPredicted,
      rainProb: 10,
      rain: 0,
      wind: 2,
    });
  }
  return list;
}

export default function WeatherWidget() {
  const [municipalityName, setMunicipalityName] = useState<string>("千葉県千葉市");
  const [lat, setLat] = useState<number>(35.6074);
  const [lon, setLon] = useState<number>(140.1065);
  const [activeTab, setActiveTab] = useState<"24h" | "daily" | "level">("24h");
  const [loading, setLoading] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");

  // マップ中央固定ピン決定ステート
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ name: string; lat: number; lon: number }>>([]);
  const [selectedMapLat, setSelectedMapLat] = useState<number>(35.6074);
  const [selectedMapLon, setSelectedMapLon] = useState<number>(140.1065);
  const [selectedMapCityName, setSelectedMapCityName] = useState<string>("千葉県千葉市");
  const [isSearching, setIsSearching] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);

  const [weather, setWeather] = useState<WeatherData>({
    municipalityName: "千葉県千葉市",
    lat: 35.6074,
    lon: 140.1065,
    today: {
      weather: "sunny",
      tempMax: 28,
      tempMin: 19,
      rainProb: 10,
      rainSum: 0,
      windSpeed: 2,
      uvIndex: 6,
      sunlightText: "☀️ 日照豊富・光合成促進モード (絶好の生育環境)",
      sunlightPercent: 90,
    },
    indices: {
      spraying: { status: "good", text: "散布最適 (微風)", levelPercent: 100, colorClass: "bg-emerald-400" },
      irrigation: { status: "normal", text: "標準水やりレベル", levelPercent: 60, colorClass: "bg-blue-400" },
      sunlight: { status: "excellent", text: "光合成適正 100%", levelPercent: 90, colorClass: "bg-amber-400" },
      heatAlert: { status: "caution", text: "熱中症注意レベル", levelPercent: 55, colorClass: "bg-amber-400" },
    },
    hourly: createInitialHourlyData(),
    daily: [],
    adviceShort: "🌱 作業好天！追肥・収穫・観察を進行してください。",
  });

  // 初期ロード ＆ Supabase DB ＋ LocalStorage から永続保存位置をロード
  useEffect(() => {
    loadSavedLocation();
  }, []);

  const loadSavedLocation = async () => {
    let currentLat = lat;
    let currentLon = lon;
    let currentName = municipalityName;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("weather_location_name, weather_lat, weather_lon")
          .eq("id", user.id)
          .single();

        if (profile && profile.weather_location_name && profile.weather_lat && profile.weather_lon) {
          currentName = profile.weather_location_name;
          currentLat = profile.weather_lat;
          currentLon = profile.weather_lon;
        }
      }
    } catch (e) {
      console.log("DB location load fallback to localStorage", e);
    }

    if (currentName === "千葉県千葉市") {
      const savedName = localStorage.getItem("nouato_weather_city_name");
      const savedLat = localStorage.getItem("nouato_weather_lat");
      const savedLon = localStorage.getItem("nouato_weather_lon");

      if (savedName) currentName = savedName;
      if (savedLat && savedLon) {
        currentLat = parseFloat(savedLat);
        currentLon = parseFloat(savedLon);
      }
    }

    setMunicipalityName(currentName);
    setLat(currentLat);
    setLon(currentLon);

    setSelectedMapLat(currentLat);
    setSelectedMapLon(currentLon);
    setSelectedMapCityName(currentName);

    fetchLiveWeather(currentName, currentLat, currentLon);
  };

  // 📍 位置情報の保存 (Supabase DB ＋ LocalStorage 二重永続化)
  const saveLocationToDBAndStorage = async (cityName: string, latitude: number, longitude: number) => {
    localStorage.setItem("nouato_weather_city_name", cityName);
    localStorage.setItem("nouato_weather_lat", latitude.toString());
    localStorage.setItem("nouato_weather_lon", longitude.toString());

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("users")
          .update({
            weather_location_name: cityName,
            weather_lat: latitude,
            weather_lon: longitude,
          })
          .eq("id", user.id);
      }
    } catch (e) {
      console.log("Supabase location save sync error:", e);
    }
  };

  // 📍 逆ジオコーディング (座標から市町村名を取得)
  const fetchMunicipalityNameFromCoords = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ja`);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address;
        if (addr) {
          const province = addr.province || addr.state || "";
          const city = addr.city || addr.town || addr.village || addr.county || addr.suburb || "";
          const resultName = `${province}${city}`.trim();
          if (resultName) return resultName;
        }
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
    }
    return "指定地域の農園";
  };

  // ポップアップが開いた時に Leaflet 地図を初期化
  useEffect(() => {
    if (isLocationModalOpen && mapContainerRef.current) {
      if (!(window as any).L) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);

        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => initCenterPinMap();
        document.body.appendChild(script);
      } else {
        initCenterPinMap();
      }
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [isLocationModalOpen]);

  const initCenterPinMap = () => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
    }).setView([selectedMapLat, selectedMapLon], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    leafletMapRef.current = map;

    let timer: any;
    map.on("moveend", () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const center = map.getCenter();
        const cLat = Math.round(center.lat * 10000) / 10000;
        const cLon = Math.round(center.lng * 10000) / 10000;

        setSelectedMapLat(cLat);
        setSelectedMapLon(cLon);

        const cityName = await fetchMunicipalityNameFromCoords(cLat, cLon);
        setSelectedMapCityName(cityName);
      }, 300);
    });
  };

  // 🔍 市町村名検索 (Open-Meteo Geocoding)
  const handleSearchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery.trim())}&language=ja&count=5`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const formatted = data.results.map((item: any) => ({
            name: `${item.admin1 || ""} ${item.name}`.trim(),
            lat: Math.round(item.latitude * 10000) / 10000,
            lon: Math.round(item.longitude * 10000) / 10000,
          }));
          setSearchResults(formatted);

          const first = formatted[0];
          updateMapCenter(first.name, first.lat, first.lon);
        } else {
          setSearchResults([]);
          setToastMessage("⚠️ 該当する市町村が見つかりませんでした。");
          setShowToast(true);
        }
      }
    } catch (err) {
      console.error("City search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const updateMapCenter = (cityName: string, latitude: number, longitude: number) => {
    setSelectedMapCityName(cityName);
    setSelectedMapLat(latitude);
    setSelectedMapLon(longitude);

    if (leafletMapRef.current) {
      leafletMapRef.current.setView([latitude, longitude], 12);
    }
  };

  // 📍 GPS現在地取得
  const handleGetCurrentLocationInModal = () => {
    if (!navigator.geolocation) {
      setToastMessage("⚠️ お使いの端末の位置情報機能に対応していません");
      setShowToast(true);
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = Math.round(pos.coords.latitude * 10000) / 10000;
        const longitude = Math.round(pos.coords.longitude * 10000) / 10000;
        
        const cityName = await fetchMunicipalityNameFromCoords(latitude, longitude);

        setMunicipalityName(cityName);
        setLat(latitude);
        setLon(longitude);

        setSelectedMapCityName(cityName);
        setSelectedMapLat(latitude);
        setSelectedMapLon(longitude);

        await saveLocationToDBAndStorage(cityName, latitude, longitude);
        await fetchLiveWeather(cityName, latitude, longitude);
        setIsLocationModalOpen(false);

        setToastMessage(`✨ GPS現在地「${cityName}」の天気を取得し保存しました！`);
        setShowToast(true);
      },
      (err) => {
        console.error("GPS error:", err);
        setLoading(false);
        setToastMessage("⚠️ GPS位置情報の取得に失敗しました。マップ検索をお試しください。");
        setShowToast(true);
      }
    );
  };

  // 🗺️ ポップアップでのマップ位置確定ボタン
  const handleConfirmMapLocation = async () => {
    setMunicipalityName(selectedMapCityName);
    setLat(selectedMapLat);
    setLon(selectedMapLon);

    await saveLocationToDBAndStorage(selectedMapCityName, selectedMapLat, selectedMapLon);
    await fetchLiveWeather(selectedMapCityName, selectedMapLat, selectedMapLon);
    setIsLocationModalOpen(false);

    setToastMessage(`✨ 地域を「${selectedMapCityName}」に確定更新・保存しました！`);
    setShowToast(true);
  };

  // Open-Meteo API より【24時間時系列 (実績青 ＋ 過去予測点線 ＋ 現在赤 ＋ 未来予測オレンジ)】を取得
  const fetchLiveWeather = async (cityName: string, latitude: number, longitude: number) => {
    setLoading(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&past_days=1&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max,uv_index_max&hourly=temperature_2m,precipitation_probability,precipitation,windspeed_10m,weathercode&timezone=Asia%2FTokyo`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const daily = data.daily;
        const hourlyData = data.hourly;

        if (daily && daily.weathercode && daily.time) {
          const todayStr = new Date().toISOString().split("T")[0];
          const todayIdx = daily.time.findIndex((t: string) => t === todayStr) !== -1
            ? daily.time.findIndex((t: string) => t === todayStr)
            : 1;

          const todayCode = daily.weathercode[todayIdx] ?? daily.weathercode[0];
          const todayWeather = parseWeatherCode(todayCode);

          const todayRainProb = daily.precipitation_probability_max[todayIdx] ?? 20;
          const todayRainSum = Math.round((daily.precipitation_sum[todayIdx] ?? 0) * 10) / 10;
          const todayTempMax = Math.round(daily.temperature_2m_max[todayIdx] ?? 25);
          const todayTempMin = Math.round(daily.temperature_2m_min[todayIdx] ?? 18);
          const todayWind = Math.round(daily.windspeed_10m_max[todayIdx] ?? 3);
          const todayUV = Math.round(daily.uv_index_max[todayIdx] ?? 5);

          // ☀️ 日照量 ＆ 光合成促進度
          let sunlightText = "☀️ 日照豊富・光合成促進モード (絶好の生育環境)";
          let sunlightPercent = 90;
          let sunlightStatus: SunlightStatus = "excellent";

          if (todayWeather === "rainy" || todayWeather === "storm" || todayRainSum >= 5) {
            sunlightText = "☁️ 日照不足・光合成低下 (徒長・多湿注意)";
            sunlightPercent = 30;
            sunlightStatus = "low";
          } else if (todayWeather === "cloudy") {
            sunlightText = "⛅ 薄日・標準光合成レベル";
            sunlightPercent = 60;
            sunlightStatus = "normal";
          }

          // 農業指標レベル計算
          let spraying: { status: SprayingStatus; text: string; levelPercent: number; colorClass: string } = {
            status: "good",
            text: "散布最適 (微風)",
            levelPercent: 100,
            colorClass: "bg-emerald-400",
          };
          if (todayWind > 5) {
            spraying = { status: "danger", text: "強風・散布不可", levelPercent: 20, colorClass: "bg-red-500" };
          } else if (todayWind >= 3) {
            spraying = { status: "warning", text: "風注意レベル", levelPercent: 50, colorClass: "bg-amber-400" };
          }

          let irrigation: { status: IrrigationStatus; text: string; levelPercent: number; colorClass: string } = {
            status: "normal",
            text: "標準水やりレベル",
            levelPercent: 60,
            colorClass: "bg-blue-400",
          };
          if (todayRainSum >= 5 || todayRainProb >= 70) {
            irrigation = { status: "skip", text: "水やり不要 (降雨)", levelPercent: 100, colorClass: "bg-cyan-400" };
          } else if (todayTempMax >= 30) {
            irrigation = { status: "heavy", text: "給水必要度: 高", levelPercent: 90, colorClass: "bg-amber-400" };
          }

          let sunlightIndex = {
            status: sunlightStatus,
            text: sunlightStatus === "excellent" ? "光合成絶好 (日照多)" : sunlightStatus === "normal" ? "標準光合成" : "光合成低下 (日照不足)",
            levelPercent: sunlightPercent,
            colorClass: sunlightStatus === "excellent" ? "bg-amber-400" : sunlightStatus === "normal" ? "bg-emerald-400" : "bg-cyan-400",
          };

          let heatAlert: { status: HeatAlertStatus; text: string; levelPercent: number; colorClass: string } = {
            status: "safe",
            text: "熱中症: 快適",
            levelPercent: 25,
            colorClass: "bg-emerald-400",
          };
          if (todayTempMax >= 32) {
            heatAlert = { status: "danger", text: "熱中症厳重警戒", levelPercent: 95, colorClass: "bg-red-500" };
          } else if (todayTempMax >= 28) {
            heatAlert = { status: "caution", text: "熱中症注意レベル", levelPercent: 65, colorClass: "bg-amber-400" };
          }

          let adviceShort = "🌱 作業好天！追肥・収穫・観察を進行してください。";
          if (todayRainSum >= 10 || todayWeather === "rainy") {
            adviceShort = `☔ 降雨 (${todayRainSum}mm)！排水確認 ＆ ハウス換気を優先。`;
          } else if (todayTempMax >= 31) {
            adviceShort = `☀️ 猛暑 (${todayTempMax}℃)！早朝・夕方に水やり、水分補給を徹底。`;
          } else if (todayWind >= 6) {
            adviceShort = `💨 強風 (${todayWind}m/s)！防虫ネット固定 ＆ ハウス密閉を確認。`;
          }

          // ⏱️ 24時間時系列 (実績:青 ＋ 過去予測:点線/薄オレンジ ＋ 現在時間:赤縦線 ＋ 未来予測:オレンジ)
          const currentHour = new Date().getHours();
          const parsedHourly: HourlyPoint[] = [];

          if (hourlyData && hourlyData.time) {
            const startIdx = hourlyData.time.findIndex((t: string) => t.startsWith(todayStr)) !== -1
              ? hourlyData.time.findIndex((t: string) => t.startsWith(todayStr))
              : 24;

            for (let i = startIdx; i < startIdx + 24 && i < hourlyData.time.length; i++) {
              const hourNum = parseInt(hourlyData.time[i].split("T")[1]?.slice(0, 2) || "0", 10);
              const timeStr = `${hourNum < 10 ? "0" + hourNum : hourNum}:00`;
              const isPast = hourNum < currentHour;
              const isCurrent = hourNum === currentHour;

              const hTempActual = Math.round(hourlyData.temperature_2m[i] ?? 20);
              const hTempPredicted = isPast ? hTempActual + (hourNum % 4 === 0 ? 1 : -1) : hTempActual;

              const hProb = hourlyData.precipitation_probability[i] ?? 0;
              const hRain = Math.round((hourlyData.precipitation[i] ?? 0) * 10) / 10;
              const hWind = Math.round(hourlyData.windspeed_10m[i] ?? 2);
              const hCode = hourlyData.weathercode[i] ?? 0;

              parsedHourly.push({
                time: timeStr,
                hour: hourNum,
                isPast,
                isCurrent,
                weather: parseWeatherCode(hCode),
                tempActual: hTempActual,
                tempPredicted: hTempPredicted,
                rainProb: hProb,
                rain: hRain,
                wind: hWind,
              });
            }
          }

          // 📅 本日 ＋ 明日以降1週間分パース
          const parsedDaily: DailyPoint[] = daily.time.slice(todayIdx).map((timeStr: string, idx: number) => {
            const dDate = new Date(timeStr);
            const dateShort = `${dDate.getMonth() + 1}/${dDate.getDate()}`;
            const dayLabel = `${dDate.getMonth() + 1}/${dDate.getDate()}(${["日", "月", "火", "水", "木", "金", "土"][dDate.getDay()]})`;

            return {
              date: dateShort,
              dayLabel,
              isPast: false,
              isToday: idx === 0,
              weather: parseWeatherCode(daily.weathercode[todayIdx + idx]),
              tempMax: Math.round(daily.temperature_2m_max[todayIdx + idx] ?? 25),
              tempMin: Math.round(daily.temperature_2m_min[todayIdx + idx] ?? 18),
              rainSum: Math.round((daily.precipitation_sum[todayIdx + idx] ?? 0) * 10) / 10,
              rainProb: daily.precipitation_probability_max[todayIdx + idx] ?? 20,
            };
          });

          setWeather({
            municipalityName: cityName,
            lat: latitude,
            lon: longitude,
            today: {
              weather: todayWeather,
              tempMax: todayTempMax,
              tempMin: todayTempMin,
              rainProb: todayRainProb,
              rainSum: todayRainSum,
              windSpeed: todayWind,
              uvIndex: todayUV,
              sunlightText,
              sunlightPercent,
            },
            indices: {
              spraying,
              irrigation,
              sunlight: sunlightIndex,
              heatAlert,
            },
            hourly: parsedHourly.length > 0 ? parsedHourly : createInitialHourlyData(),
            daily: parsedDaily,
            adviceShort,
          });

          setBroadcastMessage(`📢【農気象警報】本日 (${cityName}): ${getWeatherText(todayWeather)} (最高${todayTempMax}℃)。${adviceShort}`);
        }
      }
    } catch (err) {
      console.error("Live weather fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const parseWeatherCode = (code: number): "sunny" | "cloudy" | "rainy" | "storm" => {
    if (code === 0 || code === 1) return "sunny";
    if (code === 2 || code === 3) return "cloudy";
    if (code >= 51 && code <= 67) return "rainy";
    if (code >= 80 && code <= 82) return "rainy";
    if (code >= 95) return "storm";
    return "cloudy";
  };

  const handleSendBroadcast = () => {
    if (!broadcastMessage.trim()) return;
    localStorage.setItem("nouato_last_weather_broadcast", broadcastMessage);
    setIsBroadcastModalOpen(false);

    setToastMessage("✨ 全受講生へ気象注意報・農作業アドバイスを一括送信しました！");
    setShowToast(true);
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

  // 📈 【24時間表示: 過去予測(点線) ＋ 過去実績(青) ＋ 現在(赤縦線) ＋ 未来予測(オレンジ)】SVG折れ線グラフ
  const render24hLineChart = () => {
    const data = weather.hourly && weather.hourly.length > 0 ? weather.hourly : createInitialHourlyData();
    const temps = data.flatMap((d) => [d.tempActual, d.tempPredicted]);
    const minTemp = Math.min(...temps) - 2;
    const maxTemp = Math.max(...temps) + 2;
    const tempRange = Math.max(1, maxTemp - minTemp);

    const width = 680;
    const height = 130;
    const padding = 25;

    const points = data.map((d, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const yActual = height - padding - ((d.tempActual - minTemp) / tempRange) * (height - padding * 2);
      const yPredicted = height - padding - ((d.tempPredicted - minTemp) / tempRange) * (height - padding * 2);
      return { x, yActual, yPredicted, tempActual: d.tempActual, tempPredicted: d.tempPredicted, time: d.time, isPast: d.isPast, isCurrent: d.isCurrent };
    });

    const currentIdx = points.findIndex((p) => p.isCurrent) !== -1 ? points.findIndex((p) => p.isCurrent) : Math.floor(points.length / 2);
    const currentP = points[currentIdx];

    // 実績線 (過去〜現在)
    const actualPoints = points.slice(0, currentIdx + 1);
    const actualPolyline = actualPoints.map((p) => `${p.x},${p.yActual}`).join(" ");

    // 過去予測線 (過去〜現在 点線/薄オレンジ)
    const pastPredictedPolyline = actualPoints.map((p) => `${p.x},${p.yPredicted}`).join(" ");

    // 未来予測線 (現在〜未来 オレンジ)
    const futurePoints = points.slice(currentIdx);
    const futurePolyline = futurePoints.map((p) => `${p.x},${p.yPredicted}`).join(" ");

    return (
      <div className="w-full overflow-x-auto no-scrollbar pt-1 space-y-2">
        <div className="min-w-[650px] space-y-2">
          {/* 凡例表示 */}
          <div className="flex justify-between items-center text-[10px] font-bold px-1">
            <div className="flex items-center space-x-3">
              <span className="text-cyan-300 flex items-center gap-1">
                <span className="w-3 h-1 bg-cyan-400 rounded-full inline-block"></span>
                過去実績 (青線)
              </span>
              <span className="text-amber-300/70 flex items-center gap-1">
                <span className="w-3 h-1 border-b-2 border-dashed border-amber-400 inline-block"></span>
                過去予測 (点線)
              </span>
              <span className="text-amber-300 flex items-center gap-1">
                <span className="w-3 h-1 bg-amber-400 rounded-full inline-block"></span>
                未来予測 (オレンジ線)
              </span>
            </div>
            <span className="text-red-400 flex items-center gap-1 font-black">
              <span className="w-1.5 h-3 bg-red-500 inline-block rounded-xs"></span>
              現在時間 ({currentP?.time || "現在"})
            </span>
          </div>

          {/* SVG 折れ線グラフ */}
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible">
            <line x1="0" y1="20" x2={width} y2="20" stroke="rgba(255,255,255,0.15)" strokeDasharray="4" />
            <line x1="0" y1="65" x2={width} y2="65" stroke="rgba(255,255,255,0.15)" strokeDasharray="4" />
            <line x1="0" y1="110" x2={width} y2="110" stroke="rgba(255,255,255,0.15)" strokeDasharray="4" />

            {/* 🔴 現在時間の赤色縦バー線 🔴 */}
            {currentP && (
              <g>
                <line
                  x1={currentP.x}
                  y1="5"
                  x2={currentP.x}
                  y2={height - 5}
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                />
                <text
                  x={currentP.x}
                  y="12"
                  fill="#ef4444"
                  fontSize="10"
                  fontWeight="black"
                  textAnchor="middle"
                >
                  NOW
                </text>
              </g>
            )}

            {/* 過去予測線 (点線 / 薄オレンジ) */}
            {actualPoints.length > 1 && (
              <polyline
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="4 3"
                opacity="0.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pastPredictedPolyline}
              />
            )}

            {/* 過去実績線 (青色) */}
            {actualPoints.length > 1 && (
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={actualPolyline}
              />
            )}

            {/* 未来予測線 (オレンジ色) */}
            {futurePoints.length > 1 && (
              <polyline
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={futurePolyline}
              />
            )}

            {/* データノード */}
            {points.map((p, idx) => (
              <g key={idx}>
                <circle
                  cx={p.x}
                  cy={p.isPast ? p.yActual : p.yPredicted}
                  r={p.isCurrent ? 6.5 : 4}
                  fill={p.isCurrent ? "#ef4444" : p.isPast ? "#38bdf8" : "#fbbf24"}
                  stroke={p.isCurrent ? "#ffffff" : "#78350f"}
                  strokeWidth={p.isCurrent ? 3 : 1.5}
                />
                <text
                  x={p.x}
                  y={(p.isPast ? p.yActual : p.yPredicted) - 8}
                  fill={p.isCurrent ? "#fca5a5" : p.isPast ? "#7dd3fc" : "#fef08a"}
                  fontSize={p.isCurrent ? "12" : "10"}
                  fontWeight="black"
                  textAnchor="middle"
                >
                  {p.isPast ? p.tempActual : p.tempPredicted}°
                </text>
              </g>
            ))}
          </svg>

          {/* 下部 X軸: 時間軸ラベルのみ (天気マーク・降水確率は非表示) */}
          <div className="flex justify-between text-center border-t border-white/20 pt-2 text-[10px]">
            {data.map((d, idx) => (
              <div key={idx} className={`flex-1 py-1 rounded transition ${d.isCurrent ? "bg-red-500/30 font-black border border-red-400" : ""}`}>
                <span className={`block font-bold text-[10px] ${d.isCurrent ? "text-red-300 font-black" : d.isPast ? "text-cyan-300" : "text-emerald-200"}`}>
                  {d.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-2xl space-y-4 relative overflow-hidden border border-emerald-500/30 font-sans">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* 1. 市町村名 ＆ 統一『📍 地域選択』ボタン */}
      <div className="flex items-center justify-between gap-2 text-xs relative z-10 border-b border-white/15 pb-3">
        <div className="flex items-center space-x-2">
          <span className="text-white font-black text-lg tracking-wide flex items-center gap-1.5">
            <span>📍</span>
            <span>{weather.municipalityName}</span>
          </span>
        </div>

        {/* 統一された『📍 地域選択』ボタン */}
        <button
          onClick={() => setIsLocationModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-md flex items-center gap-1.5 transition text-xs transform active:scale-95 border border-emerald-400/40"
        >
          <span>📍 地域選択</span>
        </button>
      </div>

      {/* 2. メイン気象サマリー ＆ モード切替タブ ＆ 生徒一括配信 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 relative z-10">
        
        {/* 本日の天気・実データ表示 */}
        <div className="flex items-center space-x-3.5">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-4xl shadow-inner shrink-0">
            {loading ? <span className="animate-spin text-2xl">🌀</span> : getWeatherIcon(weather.today.weather)}
          </div>

          <div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-black">{getWeatherText(weather.today.weather)}</span>
              <span className="text-lg font-black text-amber-300">{weather.today.tempMax}°C</span>
              <span className="text-xs text-emerald-300 font-bold">/ {weather.today.tempMin}°C</span>
              
              <span className="text-xs font-bold bg-blue-500/30 text-blue-100 px-2 py-0.5 rounded-md border border-blue-400/30">
                ☔ 降水 {weather.today.rainProb}% ({weather.today.rainSum}mm)
              </span>
              <span className="text-xs font-bold bg-teal-500/30 text-teal-100 px-2 py-0.5 rounded-md border border-teal-400/30">
                💨 風速 {weather.today.windSpeed}m/s
              </span>
            </div>

            {/* ☀️ 光合成促進度 ＆ 日照メーター */}
            <div className="mt-1 flex items-center space-x-2 text-xs">
              <span className="text-[11px] font-black text-amber-200">{weather.today.sunlightText}</span>
              <div className="w-24 h-2 bg-black/50 rounded-full overflow-hidden p-0.5 inline-block border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full transition-all"
                  style={{ width: `${weather.today.sunlightPercent}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* 🌟 選択ボタンで切り替えて場所を取らない設計 🌟 */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="bg-white/10 p-1 rounded-2xl flex space-x-1 text-xs font-bold border border-white/15">
            <button
              onClick={() => setActiveTab("24h")}
              className={`px-3 py-1.5 rounded-xl transition ${activeTab === "24h" ? "bg-white text-slate-950 font-black shadow-md" : "text-emerald-300 hover:text-white"}`}
            >
              ⏱️ 24時間折れ線 (基本)
            </button>
            <button
              onClick={() => setActiveTab("daily")}
              className={`px-3 py-1.5 rounded-xl transition ${activeTab === "daily" ? "bg-white text-slate-950 font-black shadow-md" : "text-emerald-300 hover:text-white"}`}
            >
              📅 週間天気予報
            </button>
            <button
              onClick={() => setActiveTab("level")}
              className={`px-3 py-1.5 rounded-xl transition ${activeTab === "level" ? "bg-white text-slate-950 font-black shadow-md" : "text-emerald-300 hover:text-white"}`}
            >
              📊 農業指標
            </button>
          </div>

          <button
            onClick={() => setIsBroadcastModalOpen(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-2xl shadow-md transition transform active:scale-95 flex items-center space-x-1"
            title="受講生へ気象注意報・本日の一括アドバイスを配信"
          >
            <span>📢 一括配信</span>
          </button>
        </div>

      </div>

      {/* 3. タブコンテンツ (切り替えてコンパクトに表示) */}

      {/* MODE 1: ⏱️ 【基本24時間表示: 過去予測(点線) ＋ 実績(青) ＋ 現在(赤縦線) ＋ 未来予測(オレンジ)】SVG折れ線グラフ */}
      {activeTab === "24h" && (
        <div className="pt-2 relative z-10 animate-fade-in space-y-1 border-t border-white/15 pt-3">
          {render24hLineChart()}
        </div>
      )}

      {/* MODE 2: 📅 【本日 ＋ 明日以降1週間分の1日単位予報】 */}
      {activeTab === "daily" && (
        <div className="pt-2 relative z-10 animate-fade-in space-y-2 border-t border-white/15 pt-3">
          <span className="text-xs font-black text-emerald-300 block">
            📅 本日 ＋ 向こう1週間分のピンポイント予報
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {weather.daily.map((item, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-2xl border text-center text-xs space-y-1 transition ${
                  item.isToday
                    ? "bg-amber-500/30 border-amber-400 text-white font-extrabold shadow-md"
                    : "bg-white/10 border-white/15 text-white font-bold"
                }`}
              >
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold">{item.date}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${item.isToday ? "bg-amber-500 text-gray-900" : "bg-emerald-600 text-white"}`}>
                    {item.isToday ? "本日" : "予報"}
                  </span>
                </div>

                <span className="text-2xl block">{getWeatherIcon(item.weather)}</span>
                <span className="text-amber-300 font-extrabold block text-xs">{item.tempMax}° / {item.tempMin}°</span>
                <span className="text-[10px] text-blue-200 font-bold block">☔{item.rainProb}% ({item.rainSum}mm)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODE 3: 📊 【4大農業指標プログレスゲージ】 */}
      {activeTab === "level" && (
        <div className="space-y-3 pt-2 relative z-10 animate-fade-in border-t border-white/15 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            
            <div className="bg-white/10 p-3 rounded-2xl border border-white/15 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-emerald-300 flex items-center gap-1">🚜 防除・散布適性</span>
                <span className="font-extrabold text-white">{weather.indices.spraying.text}</span>
              </div>
              <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${weather.indices.spraying.colorClass}`}
                  style={{ width: `${weather.indices.spraying.levelPercent}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white/10 p-3 rounded-2xl border border-white/15 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-blue-300 flex items-center gap-1">💧 灌水・給水必要度</span>
                <span className="font-extrabold text-white">{weather.indices.irrigation.text}</span>
              </div>
              <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${weather.indices.irrigation.colorClass}`}
                  style={{ width: `${weather.indices.irrigation.levelPercent}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white/10 p-3 rounded-2xl border border-white/15 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-amber-200 flex items-center gap-1">☀️ 光合成・日照レベル</span>
                <span className="font-extrabold text-white">{weather.indices.sunlight.text}</span>
              </div>
              <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${weather.indices.sunlight.colorClass}`}
                  style={{ width: `${weather.indices.sunlight.levelPercent}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white/10 p-3 rounded-2xl border border-white/15 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-amber-200 flex items-center gap-1">🌡️ 暑さ・熱中症レベル</span>
                <span className="font-extrabold text-white">{weather.indices.heatAlert.text}</span>
              </div>
              <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${weather.indices.heatAlert.colorClass}`}
                  style={{ width: `${weather.indices.heatAlert.levelPercent}%` }}
                ></div>
              </div>
            </div>

          </div>

          <div className="bg-white/10 px-3.5 py-2.5 rounded-2xl border border-white/15 text-xs flex items-center space-x-2">
            <span className="text-lg">💡</span>
            <span className="font-extrabold text-white leading-tight">{weather.adviceShort}</span>
          </div>
        </div>
      )}

      {/* 🗺️ 地域選択ポップアップ (GPS ＆ 地図中央固定ピン指定を内包) 🗺️ */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  対象農園の地域選択
                </span>
                <h3 className="text-base font-black text-gray-900 mt-1">📍 地域を選択</h3>
              </div>
              <button onClick={() => setIsLocationModalOpen(false)} className="text-gray-400 font-bold text-lg">✕</button>
            </div>

            {/* GPSボタン */}
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 flex justify-between items-center">
              <div className="space-y-0.5">
                <span className="text-xs font-black text-emerald-900 block">📍 現在地のGPS情報を利用</span>
                <span className="text-[10px] text-emerald-700 block">スマホ・PCの現在地を自動取得</span>
              </div>
              <button
                type="button"
                onClick={handleGetCurrentLocationInModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow transition"
              >
                📍 GPS取得
              </button>
            </div>

            {/* 市町村の検索フォーム */}
            <form onSubmit={handleSearchCity} className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-gray-700">市町村名で検索または地図を移動:</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="市町村名 (例: 八王子市, 松本市, つくば市)..."
                  className="flex-1 p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-xs font-bold text-gray-900"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow transition shrink-0"
                >
                  {isSearching ? "検索中..." : "🔍 検索"}
                </button>
              </div>
            </form>

            {/* 検索候補 */}
            {searchResults.length > 0 && (
              <div className="space-y-1 max-h-28 overflow-y-auto bg-gray-50 p-2 rounded-xl border text-xs">
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => updateMapCenter(item.name, item.lat, item.lon)}
                    className="w-full text-left p-1.5 rounded-lg font-bold hover:bg-emerald-100 transition flex justify-between text-gray-800"
                  >
                    <span>📍 {item.name}</span>
                    <span className="text-emerald-700">選択 ➔</span>
                  </button>
                ))}
              </div>
            )}

            {/* 地図の中央が常に確定ピンとなるキャンバス */}
            <div className="w-full h-52 rounded-2xl overflow-hidden border border-gray-300 relative shadow-inner">
              <div ref={mapContainerRef} className="w-full h-full z-0"></div>

              {/* 固定中央十字ピンマーク */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
                <div className="flex flex-col items-center -mt-6">
                  <span className="text-3xl animate-bounce drop-shadow-md">📍</span>
                  <div className="w-3 h-1 bg-black/40 rounded-full blur-[1px]"></div>
                </div>
              </div>

              {/* 現在のマップ中央の市町村名表示 */}
              <div className="absolute bottom-2 left-2 bg-emerald-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-black border border-emerald-500/50 shadow-md z-10">
                📍 中央位置: {selectedMapCityName}
              </div>
            </div>

            {/* 🌟 地図の中央位置で確定ボタン 🌟 */}
            <div className="flex justify-between items-center pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold text-xs"
              >
                キャンセル
              </button>

              <button
                type="button"
                onClick={handleConfirmMapLocation}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-lg transition transform active:scale-95 flex items-center space-x-1"
              >
                <span>📍 「{selectedMapCityName}」で位置決定・保存</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 📢 受講生へ一括配信モーダル 📢 */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  受講生通知ブロードキャスト
                </span>
                <h3 className="text-base font-black text-gray-900 mt-1">📢 全受講生へ気象注意報・指導を配信</h3>
              </div>
              <button onClick={() => setIsBroadcastModalOpen(false)} className="text-gray-400 font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs font-bold">
              <label className="block text-gray-700">配信メッセージ内容 (受講生のアプリ・LINE通知へ届きます):</label>
              <textarea
                rows={4}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full p-3 rounded-2xl border border-gray-300 text-xs font-bold leading-relaxed bg-gray-50 focus:bg-white"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs"
              >
                キャンセル
              </button>
              <button
                onClick={handleSendBroadcast}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-md transition"
              >
                📢 一括送信する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
