'use client';

import { useState } from 'react';
import Toast from '@/components/ui/Toast';
import {
  useWeatherLive,
  saveLocationToDBAndStorage,
  fetchMunicipalityNameFromCoords,
} from './weather/useWeatherLive';
import { CitySearchModal } from './weather/CitySearchModal';
import { WeatherForecastCards } from './weather/WeatherForecastCards';
import {
  getWeatherIcon,
  getWeatherText,
  type SprayingStatus,
  type IrrigationStatus,
  type SunlightStatus,
  type HeatAlertStatus,
  type HourlyPoint,
  type DailyPoint,
  type WeatherData,
} from './weather/types';

export type {
  SprayingStatus,
  IrrigationStatus,
  SunlightStatus,
  HeatAlertStatus,
  HourlyPoint,
  DailyPoint,
  WeatherData,
};

interface WeatherWidgetProps {
  hideBroadcastButton?: boolean;
}

export default function WeatherWidget({ hideBroadcastButton = false }: WeatherWidgetProps = {}) {
  const {
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
    fetchLiveWeather,
  } = useWeatherLive();

  const [activeTab, setActiveTab] = useState<'24h' | 'daily' | 'level'>('24h');
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [showMobileDetails, setShowMobileDetails] = useState(true);

  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [showSourceTooltip, setShowSourceTooltip] = useState(false);

  const [selectedMapLat, setSelectedMapLat] = useState<number>(lat);
  const [selectedMapLon, setSelectedMapLon] = useState<number>(lon);
  const [selectedMapCityName, setSelectedMapCityName] = useState<string>(municipalityName);

  const handleOpenLocationModal = () => {
    setSelectedMapLat(lat);
    setSelectedMapLon(lon);
    setSelectedMapCityName(municipalityName);
    setIsLocationModalOpen(true);
  };

  const handleGetCurrentLocationInModal = () => {
    if (!navigator.geolocation) {
      setToastMessage('⚠️ お使いの端末の位置情報機能に対応していません');
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
        console.error('GPS error:', err);
        setLoading(false);
        setToastMessage('⚠️ GPS位置情報の取得に失敗しました。マップ検索をお試しください。');
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

  const handleSendBroadcast = () => {
    if (!broadcastMessage.trim()) return;
    localStorage.setItem('nouato_last_weather_broadcast', broadcastMessage);
    setIsBroadcastModalOpen(false);

    setToastMessage('✨ 全受講生へ気象注意報・農作業アドバイスを一括送信しました！');
    setShowToast(true);
  };

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-emerald-100 shadow-xl space-y-4 relative overflow-hidden transition-all duration-300">
      {showToast && (
        <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />
      )}

      {/* ヘッダーエリア */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-md text-xl">
            {getWeatherIcon(weather.today.weather)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                ピンポイント農園気象
              </span>
              <button
                type="button"
                onClick={handleOpenLocationModal}
                className="text-xs font-black text-emerald-700 hover:text-emerald-900 bg-emerald-100/80 hover:bg-emerald-200/80 px-2.5 py-0.5 rounded-full transition flex items-center space-x-1"
              >
                <span>📍 {municipalityName}</span>
                <span className="text-[10px] text-emerald-800">⚙️ 変更</span>
              </button>
            </div>
            <h2 className="text-base sm:text-lg font-black text-gray-900 mt-0.5 flex items-center gap-2">
              <span>{getWeatherText(weather.today.weather)}</span>
              <span className="text-sm font-bold text-gray-500">
                最高 <span className="text-red-500 font-extrabold">{weather.today.tempMax}°C</span>{' '}
                / 最低{' '}
                <span className="text-blue-500 font-extrabold">{weather.today.tempMin}°C</span>
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {!hideBroadcastButton && (
            <button
              type="button"
              onClick={() => setIsBroadcastModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs rounded-2xl shadow-md hover:shadow-lg transition flex items-center space-x-1.5 transform active:scale-95"
            >
              <span>📢 全員へ気象注意報送信</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fetchLiveWeather(municipalityName, lat, lon)}
            disabled={loading}
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-2xl transition flex items-center justify-center"
            title="最新気象データの再取得"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>🔄</span>
          </button>
        </div>
      </div>

      {/* 今日のサマリー情報バー */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-emerald-50/50 p-2.5 rounded-2xl border border-emerald-100/60 text-xs">
        <div className="flex items-center space-x-2 p-1.5 bg-white/80 rounded-xl border border-emerald-100/80 shadow-2xs">
          <span className="text-base">☔</span>
          <div>
            <span className="text-[10px] text-gray-500 font-bold block">降水確率 / 雨量</span>
            <span className="font-black text-gray-900">
              {weather.today.rainProb}% / {weather.today.rainSum}mm
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 p-1.5 bg-white/80 rounded-xl border border-emerald-100/80 shadow-2xs">
          <span className="text-base">💨</span>
          <div>
            <span className="text-[10px] text-gray-500 font-bold block">風速</span>
            <span className="font-black text-gray-900">{weather.today.windSpeed} m/s</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 p-1.5 bg-white/80 rounded-xl border border-emerald-100/80 shadow-2xs">
          <span className="text-base">☀️</span>
          <div>
            <span className="text-[10px] text-gray-500 font-bold block">UV / 光合成</span>
            <span className="font-black text-gray-900">
              UV {weather.today.uvIndex} ({weather.today.sunlightText})
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 p-1.5 bg-white/80 rounded-xl border border-emerald-100/80 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-base">💬</span>
          <div className="truncate">
            <span className="text-[10px] text-gray-500 font-bold block">農作業指針</span>
            <span className="font-black text-emerald-950 truncate block">
              {weather.adviceShort}
            </span>
          </div>
        </div>
      </div>

      {/* メイン気象カード ＆ 24hグラフ */}
      <WeatherForecastCards
        weather={weather}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        showMobileDetails={showMobileDetails}
        setShowMobileDetails={setShowMobileDetails}
        showSourceTooltip={showSourceTooltip}
        setShowSourceTooltip={setShowSourceTooltip}
      />

      {/* 市町村選択モーダル */}
      <CitySearchModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        selectedMapLat={selectedMapLat}
        selectedMapLon={selectedMapLon}
        selectedMapCityName={selectedMapCityName}
        onLocationSelected={(latitude, longitude, cityName) => {
          setSelectedMapLat(latitude);
          setSelectedMapLon(longitude);
          setSelectedMapCityName(cityName);
        }}
        onGetCurrentLocation={handleGetCurrentLocationInModal}
        onConfirmLocation={handleConfirmMapLocation}
        setToastMessage={setToastMessage}
        setShowToast={setShowToast}
      />

      {/* ブロードキャスト注意報送信モーダル */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  受講生通知ブロードキャスト
                </span>
                <h3 className="text-base font-black text-gray-900 mt-1">
                  📢 全受講生へ気象注意報・指導を配信
                </h3>
              </div>
              <button
                onClick={() => setIsBroadcastModalOpen(false)}
                className="text-gray-400 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">配信メッセージ内容:</label>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="【気象警報】明日午後は台風接近に伴い強風・大雨が予想されます。本日のうちにトマトの支柱固定とハウスの密閉を行ってください。"
                rows={4}
                className="w-full p-3 rounded-2xl border border-gray-300 bg-gray-50 focus:bg-white text-xs font-bold text-gray-900"
              />
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsBroadcastModalOpen(false)}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold text-xs"
              >
                キャンセル
              </button>

              <button
                type="button"
                onClick={handleSendBroadcast}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-xl text-xs shadow-lg transition transform active:scale-95"
              >
                📢 一括配信を実行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
