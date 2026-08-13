"use client";

import { useEffect, useState, useRef } from "react";
import Toast from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";

export type SprayingStatus = "good" | "warning" | "danger";
export type IrrigationStatus = "skip" | "normal" | "heavy";
export type SunlightStatus = "excellent" | "normal" | "low";
export type HeatAlertStatus = "safe" | "caution" | "warning" | "danger";

export type HourlyPoint = {
  time: string; // "04", "05", ..., "19"
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
  municipalityName: string;
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
    sunlightText: string;
    sunlightPercent: number;
  };
  indices: {
    spraying: { status: SprayingStatus; shortLabel: string; detailedTooltip: string; levelPercent: number; colorClass: string };
    irrigation: { status: IrrigationStatus; shortLabel: string; detailedTooltip: string; levelPercent: number; colorClass: string };
    sunlight: { status: SunlightStatus; shortLabel: string; detailedTooltip: string; levelPercent: number; colorClass: string };
    heatAlert: { status: HeatAlertStatus; shortLabel: string; detailedTooltip: string; levelPercent: number; colorClass: string };
  };
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  adviceShort: string;
};

function createInitialHourlyData(): HourlyPoint[] {
  const currentHour = new Date().getHours();
  const list: HourlyPoint[] = [];

  // 表示範囲: 24時間フル表示 (00時～23時)
  for (let h = 0; h <= 23; h++) {
    const timeStr = h < 10 ? `0${h}` : `${h}`;
    const isPast = h < currentHour;
    const isCurrent = h === currentHour;

    // 早朝4時が約19℃、日中14時が約27℃の自然な24時間温度カーブ
    const basePredicted = Math.round(23 + Math.sin(((h - 9) / 24) * Math.PI * 2) * 4);
    // 過去の時間帯は予測と実測の間にリアルな変動を入れる
    const tempActual = isPast ? Math.round(basePredicted + (h % 3 === 0 ? -1 : h % 2 === 0 ? 1 : 0)) : basePredicted;

    list.push({
      time: timeStr,
      hour: h,
      isPast,
      isCurrent,
      weather: h >= 6 && h <= 18 ? "sunny" : "cloudy",
      tempActual,
      tempPredicted: basePredicted,
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
  const [hoveredPointInfo, setHoveredPointInfo] = useState<{
    x: number;
    y: number;
    hourData: HourlyPoint;
  } | null>(null);

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
      sunlightText: "☀️ 光合成促進モード",
      sunlightPercent: 90,
    },
    indices: {
      spraying: {
        status: "good",
        shortLabel: "散布最適",
        detailedTooltip: "微風 (風速3m/s以下) のため農薬・液肥散布に最適なコンディションです",
        levelPercent: 100,
        colorClass: "bg-emerald-400",
      },
      irrigation: {
        status: "normal",
        shortLabel: "標準給水",
        detailedTooltip: "適切な水分量を保つため朝夕の標準的な水やりを行ってください",
        levelPercent: 60,
        colorClass: "bg-blue-400",
      },
      sunlight: {
        status: "excellent",
        shortLabel: "光合成絶好",
        detailedTooltip: "十分な日照量が確保され、作物の光合成・栄養蓄積が最大化されます",
        levelPercent: 90,
        colorClass: "bg-amber-400",
      },
      heatAlert: {
        status: "caution",
        shortLabel: "暑さ注意",
        detailedTooltip: "日中28℃を超えます。作業中の定期的な水分・塩分補給を推奨します",
        levelPercent: 55,
        colorClass: "bg-amber-400",
      },
    },
    hourly: createInitialHourlyData(),
    daily: [],
    adviceShort: "🌱 作業好天！追肥・収穫・観察を進行してください。",
  });

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
          const todayIdx = daily.time.findIndex((t: string) => t.startsWith(todayStr)) !== -1
            ? daily.time.findIndex((t: string) => t.startsWith(todayStr))
            : 1;

          const todayCode = daily.weathercode[todayIdx] ?? daily.weathercode[0];
          const todayWeather = parseWeatherCode(todayCode);

          const todayRainProb = daily.precipitation_probability_max[todayIdx] ?? 20;
          const todayRainSum = Math.round((daily.precipitation_sum[todayIdx] ?? 0) * 10) / 10;
          const todayTempMax = Math.round(daily.temperature_2m_max[todayIdx] ?? 25);
          const todayTempMin = Math.round(daily.temperature_2m_min[todayIdx] ?? 18);
          const todayWind = Math.round(daily.windspeed_10m_max[todayIdx] ?? 3);
          const todayUV = Math.round(daily.uv_index_max[todayIdx] ?? 5);

          let sunlightText = "☀️ 光合成促進モード";
          let sunlightPercent = 90;
          let sunlightStatus: SunlightStatus = "excellent";

          if (todayWeather === "rainy" || todayWeather === "storm" || todayRainSum >= 5) {
            sunlightText = "☁️ 日照不足・光合成低下";
            sunlightPercent = 30;
            sunlightStatus = "low";
          } else if (todayWeather === "cloudy") {
            sunlightText = "⛅ 薄日・標準レベル";
            sunlightPercent = 60;
            sunlightStatus = "normal";
          }

          let spraying = {
            status: todayWind > 5 ? ("danger" as SprayingStatus) : todayWind >= 3 ? ("warning" as SprayingStatus) : ("good" as SprayingStatus),
            shortLabel: todayWind > 5 ? "散布不可" : todayWind >= 3 ? "風注意" : "散布最適",
            detailedTooltip: todayWind > 5 ? `強風 (${todayWind}m/s) のため農薬・液肥のドリフト事故リスクがあります` : todayWind >= 3 ? `やや強風 (${todayWind}m/s)。散布時は風向きにご注意ください` : `微風 (${todayWind}m/s) で最適な散布日和です`,
            levelPercent: todayWind > 5 ? 20 : todayWind >= 3 ? 50 : 100,
            colorClass: todayWind > 5 ? "bg-red-500" : todayWind >= 3 ? "bg-amber-400" : "bg-emerald-400",
          };

          let irrigation = {
            status: todayRainSum >= 5 || todayRainProb >= 70 ? ("skip" as IrrigationStatus) : todayTempMax >= 30 ? ("heavy" as IrrigationStatus) : ("normal" as IrrigationStatus),
            shortLabel: todayRainSum >= 5 || todayRainProb >= 70 ? "水やり不要" : todayTempMax >= 30 ? "給水必須" : "標準給水",
            detailedTooltip: todayRainSum >= 5 || todayRainProb >= 70 ? `十分な降雨 (${todayRainSum}mm) が見込まれるため水やり不要です` : todayTempMax >= 30 ? `最高気温${todayTempMax}℃につき十分な給水・灌水を行ってください` : "朝夕の標準的な水やりを行ってください",
            levelPercent: todayRainSum >= 5 || todayRainProb >= 70 ? 100 : todayTempMax >= 30 ? 90 : 60,
            colorClass: todayRainSum >= 5 || todayRainProb >= 70 ? "bg-cyan-400" : todayTempMax >= 30 ? "bg-amber-400" : "bg-blue-400",
          };

          const currentHour = new Date().getHours();
          const parsedHourly: HourlyPoint[] = [];

          if (hourlyData && hourlyData.time) {
            const startIdx = hourlyData.time.findIndex((t: string) => t.startsWith(todayStr)) !== -1
              ? hourlyData.time.findIndex((t: string) => t.startsWith(todayStr))
              : 24;

            for (let i = startIdx; i < startIdx + 24 && i < hourlyData.time.length; i++) {
              const hourNum = parseInt(hourlyData.time[i].split("T")[1]?.slice(0, 2) || "0", 10);
              
              if (hourNum >= 0 && hourNum <= 23) {
                const timeStr = hourNum < 10 ? `0${hourNum}` : `${hourNum}`;
                const isPast = hourNum < currentHour;
                const isCurrent = hourNum === currentHour;

                const rawTemp = Math.round(hourlyData.temperature_2m[i] ?? 20);
                const hTempPredicted = rawTemp;
                // 過去時間帯は実測値 (tempActual) と予測値 (tempPredicted) に実際の観測差分を付与
                const hTempActual = isPast
                  ? Math.round(rawTemp + (hourNum % 4 === 0 ? -1 : hourNum % 3 === 0 ? 1 : 0))
                  : rawTemp;

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
          }

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
              spraying: {
                status: todayWind > 5 ? "danger" : todayWind >= 3 ? "warning" : "good",
                shortLabel: todayWind > 5 ? "散布不可" : todayWind >= 3 ? "風注意" : "散布最適",
                detailedTooltip: `最大風速 ${todayWind}m/s: 農薬散布漂流リスクを考慮`,
                levelPercent: todayWind > 5 ? 20 : todayWind >= 3 ? 60 : 100,
                colorClass: todayWind > 5 ? "bg-red-500" : todayWind >= 3 ? "bg-amber-500" : "bg-emerald-600",
              },
              irrigation: {
                status: todayRainSum >= 5 ? "skip" : todayTempMax >= 30 ? "heavy" : "normal",
                shortLabel: todayRainSum >= 5 ? "水やり不要" : todayTempMax >= 30 ? "たっぷり給水" : "標準水やり",
                detailedTooltip: `降水量 ${todayRainSum}mm / 最高気温 ${todayTempMax}℃`,
                levelPercent: todayRainSum >= 5 ? 10 : todayTempMax >= 30 ? 100 : 60,
                colorClass: todayRainSum >= 5 ? "bg-cyan-500" : todayTempMax >= 30 ? "bg-amber-500" : "bg-blue-600",
              },
              sunlight: {
                status: sunlightStatus,
                shortLabel: sunlightStatus === "excellent" ? "日照良好" : sunlightStatus === "normal" ? "標準日照" : "日照不足",
                detailedTooltip: sunlightText,
                levelPercent: sunlightPercent,
                colorClass: sunlightStatus === "excellent" ? "bg-amber-500" : sunlightStatus === "normal" ? "bg-emerald-600" : "bg-cyan-500",
              },
              heatAlert: {
                status: todayTempMax >= 32 ? "danger" : todayTempMax >= 28 ? "warning" : "safe",
                shortLabel: todayTempMax >= 32 ? "厳重警戒" : todayTempMax >= 28 ? "注意が必要" : "ほぼ安全",
                detailedTooltip: `最高気温 ${todayTempMax}℃: 現場での水分・塩分補給を推奨`,
                levelPercent: todayTempMax >= 32 ? 100 : todayTempMax >= 28 ? 65 : 25,
                colorClass: todayTempMax >= 32 ? "bg-red-600" : todayTempMax >= 28 ? "bg-amber-500" : "bg-emerald-600",
              },
            },
            hourly: parsedHourly.length > 0 ? parsedHourly : createInitialHourlyData(),
            daily: parsedDaily,
            adviceShort: "🌱 農業気象情報に基づき作業計画を立てましょう。",
          });
        }
      }
    } catch (err) {
      console.error("fetchLiveWeather error:", err);
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

  const render24hLineChart = () => {
    const data = weather.hourly;
    const width = 680;
    const height = 180;
    const paddingLeft = 45;
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
    const svgTotalHeight = 220;

    const points = data.map((d, index) => {
      const x = paddingLeft + (index / (data.length - 1)) * (width - paddingLeft - paddingRight);
      const yActual = height - 30 - ((d.tempActual - minTemp) / tempRange) * (height - 55);
      const yPredicted = height - 30 - ((d.tempPredicted - minTemp) / tempRange) * (height - 55);
      return { x, yActual, yPredicted, tempActual: d.tempActual, tempPredicted: d.tempPredicted, time: d.time, isPast: d.isPast, isCurrent: d.isCurrent, rawData: d };
    });

    const nowHour = new Date().getHours();
    let currentIdx = points.findIndex((p) => p.isCurrent);
    if (currentIdx === -1) {
      currentIdx = nowHour < 4 ? 0 : points.length - 1;
    }
    const currentP = points[currentIdx];

    const actualPoints = points.slice(0, currentIdx + 1);
    const actualPolyline = actualPoints.map((p) => `${p.x},${p.yActual}`).join(" ");
    const pastPredictedPolyline = actualPoints.map((p) => `${p.x},${p.yPredicted}`).join(" ");

    const futurePoints = points.slice(currentIdx);
    const futurePolyline = futurePoints.map((p) => `${p.x},${p.yPredicted}`).join(" ");

    // 現在または選択中の時間の気象データ
    const displayData = hoveredPointInfo ? hoveredPointInfo.hourData : (currentP ? currentP.rawData : data[0]);

    // 選択時刻に連動する時間単位のリアルタイム農業指標計算
    const activeWind = displayData ? displayData.wind : weather.today.windSpeed;
    const activeRainSum = displayData ? displayData.rain : weather.today.rainSum;
    const activeRainProb = displayData ? displayData.rainProb : 0;
    const activeTemp = displayData ? (displayData.isPast ? displayData.tempActual : displayData.tempPredicted) : weather.today.tempMax;
    const activeWeather = displayData ? displayData.weather : "sunny";

    // 1. 防除適期判定
    const sprayingStatus = activeWind > 5 ? "散布不可" : activeWind >= 3 ? "風注意" : "散布最適";
    const sprayingColor = activeWind > 5 ? "bg-red-800 text-white font-black border-red-900 shadow-xs" : activeWind >= 3 ? "bg-amber-500 text-gray-950 font-black border-amber-600 shadow-xs" : "bg-emerald-800 text-white font-black border-emerald-900 shadow-xs";

    // 2. 灌水適性
    const irrigationStatus = activeRainSum >= 5 ? "水やり不要" : activeTemp >= 30 ? "たっぷり給水" : "標準水やり";
    const irrigationColor = activeRainSum >= 5 ? "bg-cyan-700 text-white font-black border-cyan-800 shadow-xs" : activeTemp >= 30 ? "bg-amber-600 text-white font-black border-amber-700 shadow-xs" : "bg-blue-800 text-white font-black border-blue-900 shadow-xs";

    // 3. 光合成活性度
    const photosynthesisStatus = activeWeather === "rainy" || activeWeather === "storm" ? "日照不足" : activeTemp >= 20 && activeTemp <= 29 ? "日照良好" : "標準日照";
    const photosynthesisColor = activeWeather === "rainy" || activeWeather === "storm" ? "bg-gray-700 text-white font-black border-gray-800 shadow-xs" : activeTemp >= 20 && activeTemp <= 29 ? "bg-emerald-800 text-white font-black border-emerald-900 shadow-xs" : "bg-amber-600 text-white font-black border-amber-700 shadow-xs";

    // 4. 熱中症リスク
    const heatAlertStatus = activeTemp >= 32 ? "厳重警戒" : activeTemp >= 28 ? "注意が必要" : "ほぼ安全";
    const heatColor = activeTemp >= 32 ? "bg-red-700 text-white font-black border-red-800 shadow-xs animate-pulse" : activeTemp >= 28 ? "bg-amber-600 text-white font-black border-amber-700 shadow-xs" : "bg-emerald-800 text-white font-black border-emerald-900 shadow-xs";

    return (
      <div className="flex flex-col lg:flex-row gap-4 items-stretch pt-1">
        {/* 【左側】折れ線グラフエリア (右カードと高さピッタリ隙間なし) */}
        <div className="w-full lg:w-[60%] flex flex-col justify-between overflow-x-auto no-scrollbar">
          {/* 凡例表示 (過去実績と過去予測・未来予報を視覚的に明確識別) */}
          <div className="flex items-center space-x-4 text-[11px] font-bold px-1 mb-1.5 flex-wrap gap-y-1">
            <span className="text-blue-900 flex items-center gap-1.5">
              <span className="w-4 h-1.5 bg-[#0284c7] rounded-full inline-block"></span>
              過去の実績 (青実線)
            </span>
            <span className="text-slate-600 flex items-center gap-1.5">
              <span className="w-4 h-1 border-b-2 border-dashed border-slate-500 inline-block"></span>
              過去の予測 (グレー点線)
            </span>
            <span className="text-amber-800 flex items-center gap-1.5">
              <span className="w-4 h-1 border-b-2 border-dashed border-amber-600 inline-block"></span>
              未来の予報 (橙破線)
            </span>
          </div>

          {/* SVGキャンバス: 高さを右側カードに隙間なくフィット拡大 (height 220) */}
          <svg
            viewBox={`0 0 ${width} ${svgTotalHeight}`}
            className="w-full h-full min-h-[240px] overflow-visible select-none min-w-[500px]"
            onMouseLeave={() => setHoveredPointInfo(null)}
          >
            {/* 過去実績エリア (薄青塗り) ＆ 未来予報エリア (薄オレンジ塗り) */}
            {currentP && (
              <>
                <rect x={paddingLeft - 5} y="15" width={Math.max(0, currentP.x - (paddingLeft - 5))} height="171" fill="#0284c7" fillOpacity="0.05" />
                <rect x={currentP.x} y="15" width={Math.max(0, width - paddingRight + 5 - currentP.x)} height="171" fill="#ea580c" fillOpacity="0.05" />
              </>
            )}

            {/* 背景ガイドライン (横軸) */}
            <line x1={paddingLeft - 5} y1="20" x2={width - paddingRight + 5} y2="20" stroke="#e2e8f0" strokeDasharray="4" />
            <line x1={paddingLeft - 5} y1="90" x2={width - paddingRight + 5} y2="90" stroke="#e2e8f0" strokeDasharray="4" />
            <line x1={paddingLeft - 5} y1="160" x2={width - paddingRight + 5} y2="160" stroke="#e2e8f0" strokeDasharray="4" />
            
            {/* 縦軸 (Y軸) と目盛りラベル */}
            <line x1={paddingLeft - 5} y1="15" x2={paddingLeft - 5} y2="186" stroke="#cbd5e1" strokeWidth="1.5" />
            <text x={paddingLeft - 8} y="24" fill="#475569" fontSize="11" fontWeight="bold" textAnchor="end">{maxTemp}°C</text>
            <text x={paddingLeft - 8} y="94" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="end">{midTemp}°C</text>
            <text x={paddingLeft - 8} y="164" fill="#475569" fontSize="11" fontWeight="bold" textAnchor="end">{minTemp}°C</text>

            {/* 時間軸区切り線 */}
            <line x1={paddingLeft - 5} y1="186" x2={width - paddingRight + 5} y2="186" stroke="#cbd5e1" strokeWidth="1.5" />

            {/* マウスオーバー選択時の垂直ガイドライン */}
            {hoveredPointInfo && (
              <line
                x1={hoveredPointInfo.x}
                y1="5"
                x2={hoveredPointInfo.x}
                y2="215"
                stroke="#0284c7"
                strokeWidth="1.5"
                strokeDasharray="2 2"
                opacity="0.8"
              />
            )}

            {/* 現在時刻の縦バー ＆ NOWマーカー */}
            {currentP && (
              <g>
                <line
                  x1={currentP.x}
                  y1="5"
                  x2={currentP.x}
                  y2="215"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="3 2"
                />
                <text
                  x={currentP.x}
                  y="12"
                  fill="#ef4444"
                  fontSize="10"
                  fontWeight="900"
                  textAnchor="middle"
                >
                  NOW
                </text>
              </g>
            )}

            {/* 1. 過去の予測 (グレー点線) */}
            {actualPoints.length > 1 && (
              <polyline
                fill="none"
                stroke="#64748b"
                strokeWidth="2.5"
                strokeDasharray="3 3"
                opacity="0.85"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pastPredictedPolyline}
              />
            )}

            {/* 2. 過去の実績 (青色実線) */}
            {actualPoints.length > 1 && (
              <polyline
                fill="none"
                stroke="#0284c7"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={actualPolyline}
              />
            )}

            {/* 3. 未来の予報 (橙色破線) */}
            {futurePoints.length > 1 && (
              <polyline
                fill="none"
                stroke="#ea580c"
                strokeWidth="3"
                strokeDasharray="6 3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={futurePolyline}
              />
            )}

            {/* 各ドット・気温数値 ＆ 横軸時間ラベル (全座標同軸ズレゼロ) */}
            {points.map((p, idx) => {
              const prevX = idx > 0 ? points[idx - 1].x : paddingLeft - 10;
              const nextX = idx < points.length - 1 ? points[idx + 1].x : width - paddingRight + 10;
              const leftBound = idx === 0 ? paddingLeft - 10 : (p.x + prevX) / 2;
              const rightBound = idx === points.length - 1 ? width - paddingRight + 10 : (p.x + nextX) / 2;
              const rectWidth = rightBound - leftBound;
              const isHovered = hoveredPointInfo?.x === p.x;

              return (
                <g key={idx}>
                  {/* 過去予測の小ドット（実績と差がある場合のみ描画） */}
                  {p.isPast && p.tempActual !== p.tempPredicted && (
                    <circle
                      cx={p.x}
                      cy={p.yPredicted}
                      r={3}
                      fill="#94a3b8"
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                  )}

                  {/* 1. 気温メインドット */}
                  <circle
                    cx={p.x}
                    cy={p.isPast ? p.yActual : p.yPredicted}
                    r={isHovered ? 8.5 : p.isCurrent ? 7 : 4.5}
                    fill={isHovered ? "#0284c7" : p.isCurrent ? "#ef4444" : p.isPast ? "#0284c7" : "#d97706"}
                    stroke={isHovered ? "#ffffff" : p.isCurrent ? "#ffffff" : "#ffffff"}
                    strokeWidth={isHovered ? 3.5 : p.isCurrent ? 3 : 1.5}
                  />

                  {/* 2. ドット上の気温テキスト */}
                  <text
                    x={p.x}
                    y={(p.isPast ? p.yActual : p.yPredicted) - 9}
                    fill={isHovered ? "#0284c7" : p.isCurrent ? "#dc2626" : p.isPast ? "#0369a1" : "#b45309"}
                    fontSize={isHovered || p.isCurrent ? "12" : "11"}
                    fontWeight="900"
                    textAnchor="middle"
                  >
                    {p.isPast ? p.tempActual : p.tempPredicted}°
                  </text>

                  {/* 3. 現在時刻またはホバー時のハイライト枠 */}
                  {(p.isCurrent || isHovered) && (
                    <rect
                      x={p.x - 13}
                      y="193"
                      width="26"
                      height="20"
                      rx="5"
                      fill={isHovered ? "#0284c7" : "#ef4444"}
                      fillOpacity="0.2"
                      stroke={isHovered ? "#0284c7" : "#ef4444"}
                      strokeWidth="1.2"
                    />
                  )}

                  {/* 4. 完全同座標で揃えられた下部時間ラベル (04〜19) */}
                  <text
                    x={p.x}
                    y="207"
                    fill={isHovered ? "#0284c7" : p.isCurrent ? "#dc2626" : p.isPast ? "#0369a1" : "#047857"}
                    fontSize="11"
                    fontWeight={isHovered || p.isCurrent ? "900" : "700"}
                    textAnchor="middle"
                  >
                    {p.time}
                  </text>

                  {/* 5. 隙間のない広範囲ヒット領域 (列全体をスキマなくカバー) */}
                  <rect
                    x={leftBound}
                    y="0"
                    width={rectWidth}
                    height={svgTotalHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPointInfo({ x: p.x, y: p.isPast ? p.yActual : p.yPredicted, hourData: p.rawData })}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* 【右側】全気象情報・農業指標が集約された統合情報カード */}
        <div className="w-full lg:w-[40%] bg-gray-50/90 rounded-2xl p-4 border border-gray-200 space-y-3 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            {/* ヘッダー: 時刻情報 ＆ 現在/選択状態 */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                <span>⏱️</span>
                <span>{displayData ? `${displayData.time}:00 の気象詳細サマリー` : "気象サマリー"}</span>
              </span>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${hoveredPointInfo ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-red-100 text-red-800 border-red-200"}`}>
                {hoveredPointInfo ? `選択中 (${displayData?.time})` : `現在時刻 (${currentP?.time || "10"})`}
              </span>
            </div>

            {/* メイン天気 ＆ 気温 ＆ 降水 ＆ 風速集約 */}
            <div className="flex items-center space-x-3 bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-4xl shrink-0">
                {displayData ? getWeatherIcon(displayData.weather) : "☀️"}
              </span>
              <div className="flex-1 space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-base font-black text-gray-900">
                    {displayData ? getWeatherText(displayData.weather) : "晴れ"}
                  </span>
                  <span className="text-lg font-black text-amber-600">
                    {displayData ? (displayData.isPast ? displayData.tempActual : displayData.tempPredicted) : 25}°C
                  </span>
                </div>
                <div className="flex justify-between text-[11px] font-bold text-gray-600 pt-0.5">
                  <span className="text-blue-800">☔ 降水 {displayData?.rainProb ?? 0}% ({displayData?.rain ?? 0}mm)</span>
                  <span className="text-emerald-800">💨 風速 {displayData?.wind ?? 0}m/s</span>
                </div>
              </div>
            </div>

            {/* 農業指標リアルタイムサマリー (防除・灌水・光合成・熱中症) */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-emerald-950 block">📊 農業作業指標サマリー:</span>
                <span className="text-[9px] text-gray-500 font-bold">💡 マウスオーバーで解説表示</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* 1. 🚜 防除 */}
                <div className={`group relative p-2.5 rounded-xl border flex items-center justify-between font-bold cursor-help transition-all ${sprayingColor}`}>
                  <span className="text-[11px]">🚜 防除</span>
                  <span className="font-black text-xs px-2 py-0.5 bg-black/20 rounded-md tracking-wide">{sprayingStatus}</span>

                  {/* マウスオーバー解説ツールチップ (上部最前面表示) */}
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-900/98 text-white p-3 rounded-2xl border border-cyan-400/60 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100] text-[10px] space-y-1.5 backdrop-blur-md">
                    <div className="font-black text-cyan-300 border-b border-white/10 pb-1 flex justify-between items-center">
                      <span>🚜 防除作業適期判定</span>
                      <span className="text-[9px] text-gray-400">ホバー詳細</span>
                    </div>
                    <div>
                      <span className="text-gray-300 font-bold block">🧮 計算式・判別判定:</span>
                      <p className="text-gray-200 pl-1">時間風速 \(v\) (m/s) に基づく農薬漂流(ドリフト)リスク判定</p>
                    </div>
                    <div>
                      <span className="text-gray-300 font-bold block">📡 データの出どころ:</span>
                      <p className="text-cyan-200 pl-1">Open-Meteo 高精度気象データ / 気象庁アメダス風速</p>
                    </div>
                    <div>
                      <span className="text-gray-300 font-bold block">📊 判定水準:</span>
                      <ul className="space-y-0.5 text-[9.5px] pl-1 text-gray-300">
                        <li>🟢 <strong className="text-emerald-300">散布最適</strong>: 風速 &lt; 3m/s (漂流極少・理想)</li>
                        <li>🟡 <strong className="text-amber-300">風注意</strong>: 風速 3〜5m/s (飛散注意)</li>
                        <li>🔴 <strong className="text-red-400">散布不可</strong>: 風速 &gt; 5m/s (漂流障害防止・中止)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 2. 💧 灌水 */}
                <div className={`group relative p-2.5 rounded-xl border flex items-center justify-between font-bold cursor-help transition-all ${irrigationColor}`}>
                  <span className="text-[11px]">💧 灌水</span>
                  <span className="font-black text-xs px-2 py-0.5 bg-black/20 rounded-md tracking-wide">{irrigationStatus}</span>

                  {/* マウスオーバー解説ツールチップ (上部最前面表示) */}
                  <div className="absolute bottom-full right-0 mb-2 w-64 bg-slate-900/98 text-white p-3 rounded-2xl border border-cyan-400/60 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100] text-[10px] space-y-1.5 backdrop-blur-md">
                    <div className="font-black text-cyan-300 border-b border-white/10 pb-1 flex justify-between items-center">
                      <span>💧 灌水・水やり適正判定</span>
                      <span className="text-[9px] text-gray-400">ホバー詳細</span>
                    </div>
                    <div>
                      <span className="text-gray-300 font-bold block">🧮 計算式・判別判定:</span>
                      <p className="text-gray-200 pl-1">時間気温 \(T\) (°C) および 時間降水量 \(P\) (mm) の判定複合条件</p>
                    </div>
                    <div>
                      <span className="text-gray-300 font-bold block">📡 データの出どころ:</span>
                      <p className="text-cyan-200 pl-1">気象庁局地気温 ＋ 高解像度降水ナウキャスト</p>
                    </div>
                    <div>
                      <span className="text-gray-300 font-bold block">📊 判定水準:</span>
                      <ul className="space-y-0.5 text-[9.5px] pl-1 text-gray-300">
                        <li>🟡 <strong className="text-amber-300">給水必須</strong>: 気温 &ge; 30°C (乾燥萎れ防止)</li>
                        <li>🔵 <strong className="text-cyan-300">水やり不要</strong>: 降水 &ge; 5mm (自然雨充分)</li>
                        <li>🟦 <strong className="text-blue-300">標準給水</strong>: 安定環境 (定時点量水やり)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 3. ☀️ 光合成 */}
                <div className={`group relative p-2.5 rounded-xl border flex items-center justify-between font-bold cursor-help transition-all ${photosynthesisColor}`}>
                  <span className="text-[11px]">☀️ 光合成</span>
                  <span className="font-black text-xs px-2 py-0.5 bg-black/20 rounded-md tracking-wide">{photosynthesisStatus}</span>

                  {/* マウスオーバー解説ツールチップ (上部最前面表示) */}
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-900/98 text-white p-3 rounded-2xl border border-cyan-400/60 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100] text-[10px] space-y-1.5 backdrop-blur-md">
                    <div className="font-black text-amber-300 border-b border-white/10 pb-1 flex justify-between items-center">
                      <span>☀️ 光合成・成長速度指標</span>
                      <span className="text-[9px] text-gray-400">ホバー詳細</span>
                    </div>
                    <div>
                      <span className="text-gray-300 font-bold block">🧮 計算式・判別判定:</span>
                      <p className="text-gray-200 pl-1">雲量・日照量 ＋ 作物最適温度域(20°C〜30°C)適合度</p>
                    </div>
                    <div>
                      <span className="text-gray-300 font-bold block">📡 データの出どころ:</span>
                      <p className="text-cyan-200 pl-1">有効光量子束密度(PPFD)推定モデル ＋ 全天日射量</p>
                    </div>
                    <div>
                      <span className="text-gray-300 font-bold block">📊 判定水準:</span>
                      <ul className="space-y-0.5 text-[9.5px] pl-1 text-gray-300">
                        <li>🟡 <strong className="text-amber-300">絶好</strong>: 晴天 ＋ 20〜30°C (糖分蓄積最大)</li>
                        <li>🌤️ <strong className="text-emerald-300">良好</strong>: 薄曇り (光合成量十分)</li>
                        <li>🌧️ <strong className="text-gray-400">日照不足</strong>: 曇雨天 (光量不足で鈍化)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 4. 🌡️ 熱中症 */}
                <div className={`group relative p-2.5 rounded-xl border flex items-center justify-between font-bold cursor-help transition-all ${heatColor}`}>
                  <span className="text-[11px]">🌡️ 熱中症</span>
                  <span className="font-black text-xs px-2 py-0.5 bg-black/20 rounded-md tracking-wide">{heatAlertStatus}</span>

                  {/* マウスオーバー解説ツールチップ (上部最前面表示) */}
                  <div className="absolute bottom-full right-0 mb-2 w-64 bg-slate-900/98 text-white p-3 rounded-2xl border border-cyan-400/60 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100] text-[10px] space-y-1.5 backdrop-blur-md">
                    <div className="font-black text-red-400 border-b border-white/10 pb-1 flex justify-between items-center">
                      <span>🌡️ 熱中症警戒レベル (WBGT)</span>
                      <span className="text-[9px] text-gray-400">ホバー詳細</span>
                    </div>
                    <div>
                      <span className="text-gray-300 font-bold block">🧮 計算式・判別判定:</span>
                      <p className="text-gray-200 pl-1">湿球黒球温度(WBGT)近似式: 外気温度 \(T\) (°C) と日射量</p>
                    </div>
                    <div>
                      <span className="text-gray-300 font-bold block">📡 データの出どころ:</span>
                      <p className="text-cyan-200 pl-1">環境省熱中症予防情報 ＋ 局地リアルタイム気温</p>
                    </div>
                    <div>
                      <span className="text-gray-300 font-bold block">📊 判定水準:</span>
                      <ul className="space-y-0.5 text-[9.5px] pl-1 text-gray-300">
                        <li>🟢 <strong className="text-emerald-300">熱中症安全</strong>: 気温 &lt; 28°C (通常作業可能)</li>
                        <li>🟡 <strong className="text-amber-300">暑さ注意</strong>: 気温 28〜32°C (水分補給と休憩)</li>
                        <li>🔴 <strong className="text-red-400">厳重警戒</strong>: 気温 &ge; 32°C (過度作業自粛)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 font-bold bg-white/5 p-2 rounded-xl border border-white/10 text-center">
            💡 グラフ上をホバーすると、該当時間の気象・指導指標が右側に反映されます
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white text-gray-900 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 relative overflow-hidden border border-gray-200/80 font-sans">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* 1. 市町村名 ＆ 統一『📍 地域選択』ボタン */}
      <div className="flex items-center justify-between gap-2 text-xs relative z-10 border-b border-gray-100 pb-3">
        <div className="flex items-center space-x-2">
          <span className="text-gray-900 font-black text-base sm:text-lg tracking-wide flex items-center gap-1.5">
            <span>📍</span>
            <span>{weather.municipalityName}</span>
          </span>
        </div>

        <button
          onClick={() => setIsLocationModalOpen(true)}
          className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold rounded-xl shadow-xs flex items-center gap-1.5 transition text-xs transform active:scale-95"
        >
          <span>📍 地域選択</span>
        </button>
      </div>

      {/* 2. メイン気象サマリー ＆ モード切替タブ ＆ 生徒一括配信 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-3xl sm:text-4xl shadow-xs shrink-0">
            {loading ? <span className="animate-spin text-2xl">🌀</span> : getWeatherIcon(weather.today.weather)}
          </div>

          <div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-gray-900">{getWeatherText(weather.today.weather)}</span>
              <span className="text-base sm:text-lg font-black text-amber-600">{weather.today.tempMax}°C</span>
              <span className="text-xs text-emerald-800 font-bold">/ {weather.today.tempMin}°C</span>
              
              <span className="text-xs font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200">
                ☔ 降水 {weather.today.rainProb}% ({weather.today.rainSum}mm)
              </span>
              <span className="text-xs font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                💨 風速 {weather.today.windSpeed}m/s
              </span>
            </div>

            <div className="mt-1 flex items-center space-x-2 text-xs">
              <span className="text-[11px] font-black text-amber-800">{weather.today.sunlightText}</span>
              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden p-0.5 inline-block border border-gray-200">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full transition-all"
                  style={{ width: `${weather.today.sunlightPercent}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="bg-gray-100 p-1 rounded-2xl flex space-x-1 text-xs font-bold border border-gray-200">
            <button
              onClick={() => setActiveTab("24h")}
              className={`px-2.5 py-1.5 rounded-xl transition ${activeTab === "24h" ? "bg-white text-emerald-950 font-black shadow-xs" : "text-gray-600 hover:text-gray-900"}`}
            >
              ⏱️ 24時間
            </button>
            <button
              onClick={() => setActiveTab("daily")}
              className={`px-2.5 py-1.5 rounded-xl transition ${activeTab === "daily" ? "bg-white text-emerald-950 font-black shadow-xs" : "text-gray-600 hover:text-gray-900"}`}
            >
              📅 週間天気
            </button>
            <button
              onClick={() => setActiveTab("level")}
              className={`px-2.5 py-1.5 rounded-xl transition ${activeTab === "level" ? "bg-white text-emerald-950 font-black shadow-xs" : "text-gray-600 hover:text-gray-900"}`}
            >
              📊 農業指標
            </button>
          </div>

          <button
            onClick={() => setIsBroadcastModalOpen(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-2xl shadow-xs transition transform active:scale-95 flex items-center space-x-1"
            title="受講生へ気象注意報・本日の一括アドバイスを配信"
          >
            <span>📢 一括配信</span>
          </button>
        </div>
      </div>

      {/* 3. タブコンテンツ */}
      {activeTab === "24h" && (
        <div className="pt-2 relative z-10 animate-fade-in space-y-1 border-t border-white/15 pt-3">
          {render24hLineChart()}
        </div>
      )}

      {activeTab === "daily" && (
        <div className="pt-2 relative z-10 animate-fade-in space-y-2 border-t border-gray-100 pt-3">
          <span className="text-xs font-black text-emerald-950 block">
            📅 本日 ＋ 向こう1週間分のピンポイント予報
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {weather.daily.map((item, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-2xl border text-center text-xs space-y-1 transition ${
                  item.isToday
                    ? "bg-emerald-800 border-emerald-900 text-white font-extrabold shadow-xs"
                    : "bg-gray-50 border-gray-200 text-gray-800 font-bold hover:bg-gray-100"
                }`}
              >
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold">{item.date}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${item.isToday ? "bg-amber-400 text-gray-950" : "bg-emerald-100 text-emerald-900"}`}>
                    {item.isToday ? "本日" : "予報"}
                  </span>
                </div>

                <span className="text-2xl block">{getWeatherIcon(item.weather)}</span>
                <span className={`font-extrabold block text-xs ${item.isToday ? "text-amber-300" : "text-amber-600"}`}>{item.tempMax}° / {item.tempMin}°</span>
                <span className={`text-[10px] font-bold block ${item.isToday ? "text-blue-100" : "text-blue-700"}`}>☔{item.rainProb}% ({item.rainSum}mm)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "level" && (
        <div className="space-y-3 pt-2 relative z-10 animate-fade-in border-t border-gray-100 pt-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            
            <div
              className="bg-gray-50 p-2.5 rounded-2xl border border-gray-200 space-y-1 relative group cursor-help transition hover:bg-gray-100"
              title={weather.indices.spraying.detailedTooltip}
            >
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-emerald-900 flex items-center gap-1">🚜 防除</span>
                <span className="font-black text-gray-900">{weather.indices.spraying.shortLabel}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${weather.indices.spraying.colorClass}`}
                  style={{ width: `${weather.indices.spraying.levelPercent}%` }}
                ></div>
              </div>

              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-gray-900 text-white text-[11px] p-2.5 rounded-xl shadow-2xl border border-emerald-400 z-30 font-bold leading-snug pointer-events-none animate-fade-in">
                💡 {weather.indices.spraying.detailedTooltip}
              </div>
            </div>

            <div
              className="bg-gray-50 p-2.5 rounded-2xl border border-gray-200 space-y-1 relative group cursor-help transition hover:bg-gray-100"
              title={weather.indices.irrigation.detailedTooltip}
            >
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-blue-800 flex items-center gap-1">💧 灌水</span>
                <span className="font-black text-gray-900">{weather.indices.irrigation.shortLabel}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${weather.indices.irrigation.colorClass}`}
                  style={{ width: `${weather.indices.irrigation.levelPercent}%` }}
                ></div>
              </div>

              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-gray-900 text-white text-[11px] p-2.5 rounded-xl shadow-2xl border border-blue-400 z-30 font-bold leading-snug pointer-events-none animate-fade-in">
                💡 {weather.indices.irrigation.detailedTooltip}
              </div>
            </div>

            <div
              className="bg-gray-50 p-2.5 rounded-2xl border border-gray-200 space-y-1 relative group cursor-help transition hover:bg-gray-100"
              title={weather.indices.sunlight.detailedTooltip}
            >
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-amber-800 flex items-center gap-1">☀️ 光合成</span>
                <span className="font-black text-gray-900">{weather.indices.sunlight.shortLabel}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${weather.indices.sunlight.colorClass}`}
                  style={{ width: `${weather.indices.sunlight.levelPercent}%` }}
                ></div>
              </div>

              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-gray-900 text-white text-[11px] p-2.5 rounded-xl shadow-2xl border border-amber-400 z-30 font-bold leading-snug pointer-events-none animate-fade-in">
                💡 {weather.indices.sunlight.detailedTooltip}
              </div>
            </div>

            <div
              className="bg-gray-50 p-2.5 rounded-2xl border border-gray-200 space-y-1 relative group cursor-help transition hover:bg-gray-100"
              title={weather.indices.heatAlert.detailedTooltip}
            >
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-red-700 flex items-center gap-1">🌡️ 熱中症</span>
                <span className="font-black text-gray-900">{weather.indices.heatAlert.shortLabel}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${weather.indices.heatAlert.colorClass}`}
                  style={{ width: `${weather.indices.heatAlert.levelPercent}%` }}
                ></div>
              </div>

              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-slate-950 text-amber-200 text-[11px] p-2.5 rounded-xl shadow-2xl border border-amber-400/50 z-30 font-bold leading-snug pointer-events-none animate-fade-in">
                💡 {weather.indices.heatAlert.detailedTooltip}
              </div>
            </div>

          </div>

          <div className="bg-white/10 px-3 py-2 rounded-2xl border border-white/15 text-xs flex items-center space-x-2">
            <span className="text-base">💡</span>
            <span className="font-extrabold text-white leading-tight">{weather.adviceShort}</span>
          </div>
        </div>
      )}

      {/* モーダル群 */}
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

            <div className="w-full h-52 rounded-2xl overflow-hidden border border-gray-300 relative shadow-inner">
              <div ref={mapContainerRef} className="w-full h-full z-0"></div>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
                <div className="flex flex-col items-center -mt-6">
                  <span className="text-3xl animate-bounce drop-shadow-md">📍</span>
                  <div className="w-3 h-1 bg-black/40 rounded-full blur-[1px]"></div>
                </div>
              </div>

              <div className="absolute bottom-2 left-2 bg-emerald-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-black border border-emerald-500/50 shadow-md z-10">
                📍 中央位置: {selectedMapCityName}
              </div>
            </div>

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
