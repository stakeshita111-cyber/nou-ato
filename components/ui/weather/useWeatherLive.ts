'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import type {
  HourlyPoint,
  DailyPoint,
  WeatherData,
  SprayingStatus,
  IrrigationStatus,
  SunlightStatus,
  HeatAlertStatus,
} from './types';

export function createInitialHourlyData(): HourlyPoint[] {
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
    const tempActual = isPast
      ? Math.round(basePredicted + (h % 3 === 0 ? -1 : h % 2 === 0 ? 1 : 0))
      : basePredicted;

    list.push({
      time: timeStr,
      hour: h,
      isPast,
      isCurrent,
      weather: h >= 6 && h <= 18 ? 'sunny' : 'cloudy',
      tempActual,
      tempPredicted: basePredicted,
      rainProb: 10,
      rain: 0,
      wind: 2,
    });
  }
  return list;
}

export function fetchMunicipalityNameFromCoords(
  latitude: number,
  longitude: number
): Promise<string> {
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ja`
  )
    .then((res) => {
      if (res.ok) {
        return res.json().then((data) => {
          const addr = data.address;
          if (addr) {
            const province = addr.province || addr.state || '';
            const city = addr.city || addr.town || addr.village || addr.county || addr.suburb || '';
            const resultName = `${province}${city}`.trim();
            if (resultName) return resultName;
          }
          return '指定地域の農園';
        });
      }
      return '指定地域の農園';
    })
    .catch((err) => {
      console.error('Reverse geocoding error:', err);
      return '指定地域の農園';
    });
}

export function saveLocationToDBAndStorage(
  cityName: string,
  latitude: number,
  longitude: number
): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem('nouato_weather_city_name', cityName);
    localStorage.setItem('nouato_weather_lat', latitude.toString());
    localStorage.setItem('nouato_weather_lon', longitude.toString());
  }

  return (async () => {
    try {
      // 1. farm_plots の起点プロット（A1 または先頭プロット）の description に位置情報を永続保存
      const { data: plotData } = await supabase
        .from('farm_plots')
        .select('id, code, description, name, student_id')
        .or('code.eq.A1,id.eq.plot_cell_A1')
        .limit(1);

      const targetPlot = plotData && plotData.length > 0 ? plotData[0] : null;
      if (targetPlot) {
        let existingMeta: Record<string, unknown> = {};
        if (targetPlot.description) {
          try {
            existingMeta =
              typeof targetPlot.description === 'string'
                ? (JSON.parse(targetPlot.description) as Record<string, unknown>)
                : (targetPlot.description as Record<string, unknown>);
          } catch {}
        }
        const updatedMeta = {
          ...existingMeta,
          weather_location: {
            name: cityName,
            lat: latitude,
            lon: longitude,
          },
          farm_meta: {
            ...((existingMeta.farm_meta as Record<string, unknown> | undefined) || {}),
            weather_location: {
              name: cityName,
              lat: latitude,
              lon: longitude,
            },
          },
        };

        await supabase
          .from('farm_plots')
          .update({ description: JSON.stringify(updatedMeta) })
          .eq('id', targetPlot.id);
      }

      // 2. users テーブルへの更新（カラムが存在する場合の互換性保持）
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('users')
          .update({
            weather_location_name: cityName,
            weather_lat: latitude,
            weather_lon: longitude,
          } as unknown as Database['public']['Tables']['users']['Update'])
          .eq('id', user.id);
      }
    } catch (e) {
      console.log('Supabase location save sync notice:', e);
    }
  })();
}

export function useWeatherLive() {
  const [municipalityName, setMunicipalityName] = useState<string>('千葉県千葉市');
  const [lat, setLat] = useState<number>(35.6074);
  const [lon, setLon] = useState<number>(140.1065);
  const [loading, setLoading] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const [weather, setWeather] = useState<WeatherData>({
    municipalityName: '千葉県千葉市',
    lat: 35.6074,
    lon: 140.1065,
    today: {
      weather: 'sunny',
      tempMax: 28,
      tempMin: 19,
      rainProb: 10,
      rainSum: 0,
      windSpeed: 2,
      uvIndex: 6,
      sunlightText: '☀️ 光合成促進モード',
      sunlightPercent: 90,
    },
    indices: {
      spraying: {
        status: 'good',
        shortLabel: '散布最適',
        detailedTooltip: '微風 (風速3m/s以下) のため農薬・液肥散布に最適なコンディションです',
        levelPercent: 100,
        colorClass: 'bg-emerald-400',
      },
      irrigation: {
        status: 'normal',
        shortLabel: '標準給水',
        detailedTooltip: '適切な水分量を保つため朝夕の標準的な水やりを行ってください',
        levelPercent: 60,
        colorClass: 'bg-blue-400',
      },
      sunlight: {
        status: 'excellent',
        shortLabel: '光合成絶好',
        detailedTooltip: '十分な日照量が確保され、作物の光合成・栄養蓄積が最大化されます',
        levelPercent: 90,
        colorClass: 'bg-amber-400',
      },
      heatAlert: {
        status: 'caution',
        shortLabel: '暑さ注意',
        detailedTooltip: '日中28℃を超えます。作業中の定期的な水分・塩分補給を推奨します',
        levelPercent: 55,
        colorClass: 'bg-amber-400',
      },
    },
    hourly: createInitialHourlyData(),
    daily: [],
    adviceShort: '🌱 作業好天！追肥・収穫・観察を進行してください。',
  });

  const parseWeatherCode = (code: number): 'sunny' | 'cloudy' | 'rainy' | 'storm' => {
    if (code === 0 || code === 1) return 'sunny';
    if (code === 2 || code === 3) return 'cloudy';
    if (code >= 51 && code <= 67) return 'rainy';
    if (code >= 80 && code <= 82) return 'rainy';
    if (code >= 95) return 'storm';
    return 'sunny';
  };

  const fetchLiveWeather = useCallback(
    async (cityName: string, targetLat: number, targetLon: number) => {
      setLoading(true);
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,precipitation_probability,precipitation,weathercode,windspeed_10m&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max&timezone=Asia%2FTokyo`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Weather API request failed');
        const data = await response.json();

        if (data && data.daily && data.hourly) {
          const daily = data.daily;
          const hourly = data.hourly;
          const current = data.current_weather;

          const currentHour = new Date().getHours();
          const todayIdx = 0;

          const tempMax = Math.round(daily.temperature_2m_max[todayIdx] ?? 28);
          const tempMin = Math.round(daily.temperature_2m_min[todayIdx] ?? 18);
          const rainProb = Math.round(daily.precipitation_probability_max[todayIdx] ?? 0);
          const rainSum = Math.round((daily.precipitation_sum[todayIdx] ?? 0) * 10) / 10;
          const windSpeed = Math.round((current?.windspeed ?? 2) * 10) / 10;
          const uvIndex = Math.round(daily.uv_index_max[todayIdx] ?? 5);

          let sprayingStatus: SprayingStatus = 'good';
          let sprayingLabel = '散布最適';
          let sprayingTip = '微風 (風速3m/s以下) のため農薬・液肥散布に最適なコンディションです';
          let sprayingColor = 'bg-emerald-400';
          let sprayingLevel = 100;

          if (windSpeed > 5) {
            sprayingStatus = 'danger';
            sprayingLabel = '強風不可';
            sprayingTip = '風速5m/s超の強風です。ドリフト散散リスクが高いため見合わせてください';
            sprayingColor = 'bg-red-500';
            sprayingLevel = 20;
          } else if (windSpeed > 3 || rainProb > 50) {
            sprayingStatus = 'warning';
            sprayingLabel = '散布注意';
            sprayingTip = '風速3〜5m/sまたは降雨確率50%以上です。飛散や流亡に十分注意してください';
            sprayingColor = 'bg-amber-400';
            sprayingLevel = 60;
          }

          let irrigationStatus: IrrigationStatus = 'normal';
          let irrigationLabel = '標準給水';
          let irrigationTip = '適切な水分量を保つため朝夕の標準的な水やりを行ってください';
          let irrigationColor = 'bg-blue-400';
          let irrigationLevel = 60;

          if (rainSum > 10 || rainProb >= 80) {
            irrigationStatus = 'skip';
            irrigationLabel = '水やり不要';
            irrigationTip = '十分な降雨が予想されるため、過湿・根腐れ防止のため水やりは不要です';
            irrigationColor = 'bg-emerald-400';
            irrigationLevel = 100;
          } else if (tempMax >= 32 && rainSum === 0) {
            irrigationStatus = 'heavy';
            irrigationLabel = 'たっぷりと給水';
            irrigationTip =
              '猛暑のため土壌乾燥が劇的に進行します。朝の涼しい時間帯にたっぷり給水してください';
            irrigationColor = 'bg-red-500';
            irrigationLevel = 30;
          }

          let sunlightStatus: SunlightStatus = 'excellent';
          let sunlightLabel = '光合成絶好';
          let sunlightTip = '十分な日照量が確保され、作物の光合成・栄養蓄積が最大化されます';
          let sunlightColor = 'bg-amber-400';
          let sunlightLevel = 90;

          const todayWeatherCode = daily.weathercode[todayIdx];
          if (todayWeatherCode >= 51) {
            sunlightStatus = 'low';
            sunlightLabel = '日照不足';
            sunlightTip = '降雨・曇天のため光合成量が低下します。徒長や病害に注意してください';
            sunlightColor = 'bg-blue-400';
            sunlightLevel = 30;
          } else if (todayWeatherCode >= 2) {
            sunlightStatus = 'normal';
            sunlightLabel = '標準日照';
            sunlightTip = '適度な薄曇りです。高温障害のリスクが低く生育に適した気候です';
            sunlightColor = 'bg-emerald-400';
            sunlightLevel = 70;
          }

          let heatAlertStatus: HeatAlertStatus = 'safe';
          let heatAlertLabel = '快適・安全';
          let heatAlertTip = '適温域です。熱中症・作物高温障害のリスクは低く屋外作業に最適です';
          let heatAlertColor = 'bg-emerald-400';
          let heatAlertLevel = 100;

          if (tempMax >= 35) {
            heatAlertStatus = 'danger';
            heatAlertLabel = '猛暑・危険';
            heatAlertTip =
              '35℃以上の猛暑日です。日中の農作業は原則避け、冷房環境で十分休息してください';
            heatAlertColor = 'bg-red-600';
            heatAlertLevel = 15;
          } else if (tempMax >= 31) {
            heatAlertStatus = 'warning';
            heatAlertLabel = '厳重警戒';
            heatAlertTip =
              '31℃以上の厳重警戒レベルです。こまめな水分・塩分補給と日陰での休憩を行ってください';
            heatAlertColor = 'bg-red-500';
            heatAlertLevel = 35;
          } else if (tempMax >= 28) {
            heatAlertStatus = 'caution';
            heatAlertLabel = '暑さ注意';
            heatAlertTip =
              '日中28℃を超えます。作業中の定期的な水分補給と帽子着用を徹底してください';
            heatAlertColor = 'bg-amber-400';
            heatAlertLevel = 60;
          }

          const parsedHourly: HourlyPoint[] = [];
          for (let h = 0; h <= 23; h++) {
            const timeStr = h < 10 ? `0${h}` : `${h}`;
            const isPast = h < currentHour;
            const isCurrent = h === currentHour;

            const tempPredicted = Math.round(hourly.temperature_2m[h] ?? 20);
            const tempActual = isPast
              ? Math.round(tempPredicted + (h % 2 === 0 ? 0.5 : -0.5))
              : tempPredicted;

            parsedHourly.push({
              time: timeStr,
              hour: h,
              isPast,
              isCurrent,
              weather: parseWeatherCode(hourly.weathercode[h] ?? 0),
              tempActual,
              tempPredicted,
              rainProb: Math.round(hourly.precipitation_probability[h] ?? 0),
              rain: Math.round((hourly.precipitation[h] ?? 0) * 10) / 10,
              wind: Math.round((hourly.windspeed_10m[h] ?? 2) * 10) / 10,
            });
          }

          const parsedDaily: DailyPoint[] = daily.time
            .slice(0, 7)
            .map((timeStr: string, idx: number) => {
              const dDate = new Date(timeStr);
              const dateShort = `${dDate.getMonth() + 1}/${dDate.getDate()}`;
              const dayLabel = `${dDate.getMonth() + 1}/${dDate.getDate()}(${['日', '月', '火', '水', '木', '金', '土'][dDate.getDay()]})`;

              return {
                date: dateShort,
                dayLabel,
                isPast: false,
                isToday: idx === 0,
                weather: parseWeatherCode(daily.weathercode[todayIdx + idx]),
                tempMax: Math.round(daily.temperature_2m_max[todayIdx + idx] ?? 28),
                tempMin: Math.round(daily.temperature_2m_min[todayIdx + idx] ?? 18),
                rainSum: Math.round((daily.precipitation_sum[todayIdx + idx] ?? 0) * 10) / 10,
                rainProb: Math.round(daily.precipitation_probability_max[todayIdx + idx] ?? 0),
              };
            });

          let advice = '🌱 作業好天！追肥・収穫・観察を進行してください。';
          if (tempMax >= 33) {
            advice = '☀️ 猛暑警報: 早朝の涼しい時間帯に水やりと作業を集中させてください。';
          } else if (rainProb >= 70) {
            advice = '🌧️ 降雨予想: 排水溝の点検を行い、防除作業は雨上がりに延期してください。';
          } else if (windSpeed >= 6) {
            advice = '💨 強風注意: 支柱の仮留めを強化し、背の高い作物の倒伏を防いでください。';
          }

          setWeather({
            municipalityName: cityName,
            lat: targetLat,
            lon: targetLon,
            today: {
              weather: parseWeatherCode(current?.weathercode ?? 0),
              tempMax,
              tempMin,
              rainProb,
              rainSum,
              windSpeed,
              uvIndex,
              sunlightText:
                sunlightStatus === 'excellent' ? '☀️ 光合成促進モード' : '⛅ 日照適量モード',
              sunlightPercent: sunlightLevel,
            },
            indices: {
              spraying: {
                status: sprayingStatus,
                shortLabel: sprayingLabel,
                detailedTooltip: sprayingTip,
                levelPercent: sprayingLevel,
                colorClass: sprayingColor,
              },
              irrigation: {
                status: irrigationStatus,
                shortLabel: irrigationLabel,
                detailedTooltip: irrigationTip,
                levelPercent: irrigationLevel,
                colorClass: irrigationColor,
              },
              sunlight: {
                status: sunlightStatus,
                shortLabel: sunlightLabel,
                detailedTooltip: sunlightTip,
                levelPercent: sunlightLevel,
                colorClass: sunlightColor,
              },
              heatAlert: {
                status: heatAlertStatus,
                shortLabel: heatAlertLabel,
                detailedTooltip: heatAlertTip,
                levelPercent: heatAlertLevel,
                colorClass: heatAlertColor,
              },
            },
            hourly: parsedHourly,
            daily: parsedDaily,
            adviceShort: advice,
          });
        }
      } catch (err) {
        console.error('Fetch live weather error:', err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadSavedLocation = useCallback(async () => {
    let currentName = '千葉県千葉市';
    let currentLat = 35.6074;
    let currentLon = 140.1065;

    try {
      // 1. farm_plots の起点プロット description から位置情報を復元
      const { data: plotData } = await supabase
        .from('farm_plots')
        .select('description')
        .or('code.eq.A1,id.eq.plot_cell_A1')
        .limit(1);

      if (plotData && plotData.length > 0 && plotData[0].description) {
        try {
          const meta =
            typeof plotData[0].description === 'string'
              ? (JSON.parse(plotData[0].description) as Record<string, unknown>)
              : (plotData[0].description as Record<string, unknown>);

          const loc = (meta.weather_location ||
            (meta.farm_meta as Record<string, unknown> | undefined)?.weather_location) as
            { name?: string; lat?: number; lon?: number } | undefined;

          if (loc) {
            if (loc.name) currentName = loc.name;
            if (typeof loc.lat === 'number') currentLat = loc.lat;
            if (typeof loc.lon === 'number') currentLon = loc.lon;
          }
        } catch {}
      } else {
        // 2. LocalStorage の互換フォールバック
        if (typeof window !== 'undefined') {
          const savedName = localStorage.getItem('nouato_weather_city_name');
          const savedLat = localStorage.getItem('nouato_weather_lat');
          const savedLon = localStorage.getItem('nouato_weather_lon');

          if (savedName) currentName = savedName;
          if (savedLat && savedLon) {
            currentLat = parseFloat(savedLat);
            currentLon = parseFloat(savedLon);
          }
        }
      }
    } catch {
      if (typeof window !== 'undefined') {
        const savedName = localStorage.getItem('nouato_weather_city_name');
        const savedLat = localStorage.getItem('nouato_weather_lat');
        const savedLon = localStorage.getItem('nouato_weather_lon');

        if (savedName) currentName = savedName;
        if (savedLat && savedLon) {
          currentLat = parseFloat(savedLat);
          currentLon = parseFloat(savedLon);
        }
      }
    }

    setMunicipalityName(currentName);
    setLat(currentLat);
    setLon(currentLon);

    fetchLiveWeather(currentName, currentLat, currentLon);
  }, [fetchLiveWeather]);

  useEffect(() => {
    const load = async () => {
      await loadSavedLocation();
    };
    void load();
  }, [loadSavedLocation]);

  return {
    municipalityName,
    setMunicipalityName,
    lat,
    setLat,
    lon,
    setLon,
    loading,
    setLoading,
    toastMessage,
    setToastMessage,
    showToast,
    setShowToast,
    weather,
    setWeather,
    fetchLiveWeather,
    loadSavedLocation,
  };
}
