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
