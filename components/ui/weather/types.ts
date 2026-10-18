export interface LeafletMapInstance {
  remove: () => void;
  setView: (center: [number, number], zoom: number) => LeafletMapInstance;
  on: (event: string, fn: () => void) => void;
  getCenter: () => { lat: number; lng: number };
}

export interface LeafletGlobal {
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMapInstance;
  tileLayer: (
    url: string,
    options?: Record<string, unknown>
  ) => { addTo: (map: LeafletMapInstance) => void };
}

export interface UserWeatherFields {
  weather_location_name?: string | null;
  weather_lat?: number | string | null;
  weather_lon?: number | string | null;
}

export interface GeocodingResultItem {
  name: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

export type SprayingStatus = 'good' | 'warning' | 'danger';
export type IrrigationStatus = 'skip' | 'normal' | 'heavy';
export type SunlightStatus = 'excellent' | 'normal' | 'low';
export type HeatAlertStatus = 'safe' | 'caution' | 'warning' | 'danger';

export type HourlyPoint = {
  time: string; // "04", "05", ..., "19"
  hour: number;
  isPast: boolean; // 過去の実績か
  isCurrent: boolean; // 現在時間か
  weather: 'sunny' | 'cloudy' | 'rainy' | 'storm';
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
  weather: 'sunny' | 'cloudy' | 'rainy' | 'storm';
  tempMax: number;
  tempMin: number;
  rainSum: number;
  rainProb: number;
};

export function getWeatherIcon(type: string): string {
  switch (type) {
    case 'sunny':
      return '☀️';
    case 'cloudy':
      return '☁️';
    case 'rainy':
      return '🌧️';
    case 'storm':
      return '🌩️';
    default:
      return '☀️';
  }
}

export function getWeatherText(type: string): string {
  switch (type) {
    case 'sunny':
      return '晴れ';
    case 'cloudy':
      return '曇り';
    case 'rainy':
      return '雨';
    case 'storm':
      return '荒天';
    default:
      return '晴れ';
  }
}

export type WeatherData = {
  municipalityName: string;
  lat: number;
  lon: number;
  today: {
    weather: 'sunny' | 'cloudy' | 'rainy' | 'storm';
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
    spraying: {
      status: SprayingStatus;
      shortLabel: string;
      detailedTooltip: string;
      levelPercent: number;
      colorClass: string;
    };
    irrigation: {
      status: IrrigationStatus;
      shortLabel: string;
      detailedTooltip: string;
      levelPercent: number;
      colorClass: string;
    };
    sunlight: {
      status: SunlightStatus;
      shortLabel: string;
      detailedTooltip: string;
      levelPercent: number;
      colorClass: string;
    };
    heatAlert: {
      status: HeatAlertStatus;
      shortLabel: string;
      detailedTooltip: string;
      levelPercent: number;
      colorClass: string;
    };
  };
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  adviceShort: string;
};

export interface AgriAdvice {
  icon: string;
  badge: string;
  message: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  badgeClass: string;
}

export function getAgriAdvice(weather: WeatherData): AgriAdvice {
  const { today, indices } = weather;

  // 1. 降雨予報・高湿度時
  if (
    today.rainProb >= 60 ||
    today.rainSum >= 5 ||
    today.weather === 'rainy' ||
    today.weather === 'storm'
  ) {
    return {
      icon: '☔',
      badge: '降雨予報・水やり控え目',
      message: '今日・明日は雨予報のため、畝の水やりは控えめでOKです',
      bgClass: 'bg-blue-50/90',
      borderClass: 'border-blue-200',
      textClass: 'text-blue-950',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    };
  }

  // 2. 高温注意報・熱中症警戒時
  if (
    today.tempMax >= 31 ||
    indices.heatAlert.status === 'danger' ||
    indices.heatAlert.status === 'warning'
  ) {
    return {
      icon: '☀️',
      badge: '高温注意・熱中症警戒',
      message: '厳しい暑さが予想されます。農作業や収穫は朝夕の涼しい時間帯に行いましょう',
      bgClass: 'bg-amber-50/90',
      borderClass: 'border-amber-200',
      textClass: 'text-amber-950',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    };
  }

  // 3. 強風時
  if (today.windSpeed >= 5.5 || indices.spraying.status === 'danger') {
    return {
      icon: '💨',
      badge: '強風注意・資材固定',
      message: '風が強いため支柱や防風ネットの固定を点検し、農薬・液肥散布は見合わせましょう',
      bgClass: 'bg-orange-50/90',
      borderClass: 'border-orange-200',
      textClass: 'text-orange-950',
      badgeClass: 'bg-orange-100 text-orange-900 border-orange-300',
    };
  }

  // 4. 散布適性良好時
  if (indices.spraying.status === 'good') {
    return {
      icon: '🍃',
      badge: '散布適性良好',
      message: '風が穏やかで、葉面散布や害虫対策に適した天候です',
      bgClass: 'bg-emerald-50/90',
      borderClass: 'border-emerald-200',
      textClass: 'text-emerald-950',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };
  }

  // 5. 標準・好天
  return {
    icon: '🌱',
    badge: '農作業日和',
    message: '安定した天候です。畑の観察や追肥、収穫を計画的に行いましょう',
    bgClass: 'bg-emerald-50/90',
    borderClass: 'border-emerald-200',
    textClass: 'text-emerald-950',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  };
}
