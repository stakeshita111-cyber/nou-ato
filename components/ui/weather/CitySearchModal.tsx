'use client';

import { useState } from 'react';
import type { LeafletMapInstance } from './types';
import { WeatherMapView } from './WeatherMapView';
import { searchLocations, type SearchLocationResult } from './geocoding';

interface CitySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMapLat: number;
  selectedMapLon: number;
  selectedMapCityName: string;
  onLocationSelected: (lat: number, lon: number, cityName: string) => void;
  onGetCurrentLocation: () => void;
  onConfirmLocation: () => void;
  toastMessage?: string;
  showToast?: boolean;
  setToastMessage: (msg: string) => void;
  setShowToast: (show: boolean) => void;
  gpsErrorMessage?: string | null;
}

export function CitySearchModal({
  isOpen,
  onClose,
  selectedMapLat,
  selectedMapLon,
  selectedMapCityName,
  onLocationSelected,
  onGetCurrentLocation,
  onConfirmLocation,
  setToastMessage,
  setShowToast,
  gpsErrorMessage,
}: CitySearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchLocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapInstance, setMapInstance] = useState<LeafletMapInstance | null>(null);

  if (!isOpen) return null;

  const updateMapCenter = (cityName: string, latitude: number, longitude: number) => {
    onLocationSelected(latitude, longitude, cityName);
    if (mapInstance) {
      mapInstance.setView([latitude, longitude], 13);
    }
  };

  const handleSearchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    try {
      const results = await searchLocations(query);
      if (results.length > 0) {
        setSearchResults(results);
        const first = results[0];
        updateMapCenter(first.name, first.lat, first.lon);
        setToastMessage(`✨ 「${first.name}」を表示しました（候補${results.length}件）`);
        setShowToast(true);
      } else {
        setSearchResults([]);
        setToastMessage(
          `⚠️ 「${query}」に該当する市町村が見つかりませんでした。別の名称（例: 千葉市、八王子市等）をお試しください。`
        );
        setShowToast(true);
      }
    } catch (err) {
      console.error('City search error:', err);
      setToastMessage('⚠️ 検索中にエラーが発生しました。通信環境をご確認ください。');
      setShowToast(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResultItem = (item: SearchLocationResult) => {
    updateMapCenter(item.name, item.lat, item.lon);
    setToastMessage(`📍 「${item.name}」へ移動しました`);
    setShowToast(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in text-gray-800">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 border border-gray-200 relative">
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2.5 py-0.5 rounded-full">
              対象農園の地域選択
            </span>
            <h3 className="text-base font-black text-gray-900 mt-1">📍 地域を選択</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1"
          >
            ✕
          </button>
        </div>

        <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 flex justify-between items-center">
          <div className="space-y-0.5">
            <span className="text-xs font-black text-emerald-900 block">
              📍 現在地のGPS情報を利用
            </span>
            <span className="text-[10px] text-emerald-700 block">スマホ・PCの現在地を自動取得</span>
          </div>
          <button
            type="button"
            onClick={onGetCurrentLocation}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow transition"
          >
            📍 GPS取得
          </button>
        </div>

        {gpsErrorMessage && (
          <div
            role="alert"
            className="bg-rose-50 border-2 border-rose-300 text-rose-950 p-3 rounded-2xl text-xs flex items-start space-x-2.5 animate-fade-in shadow-xs"
          >
            <span className="text-base shrink-0 leading-none">⚠️</span>
            <div className="flex-1 leading-relaxed">
              <strong className="block font-black text-rose-900 mb-0.5">
                GPS位置情報の取得に失敗しました
              </strong>
              <p className="font-medium text-rose-800">{gpsErrorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSearchCity} className="space-y-1.5 pt-1">
          <label className="block text-xs font-bold text-gray-700">
            市町村名で検索または地図を移動:
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.nativeEvent.isComposing) {
                  e.stopPropagation();
                }
              }}
              placeholder="市町村名・地域名 (例: 千葉, 八王子市, 松本市)..."
              className="flex-1 p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-xs font-bold text-gray-900"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-bold rounded-xl text-xs shadow transition shrink-0"
            >
              {isSearching ? '検索中...' : '🔍 検索'}
            </button>
          </div>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-1 max-h-28 overflow-y-auto bg-gray-50 p-2 rounded-xl border text-xs">
            {searchResults.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectResultItem(item)}
                className="w-full text-left p-1.5 rounded-lg font-bold hover:bg-emerald-100 transition flex justify-between text-gray-800"
              >
                <span>📍 {item.name}</span>
                <span className="text-emerald-700">選択 ➔</span>
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <WeatherMapView
            isOpen={isOpen}
            selectedLat={selectedMapLat}
            selectedLon={selectedMapLon}
            onLocationChange={(lat, lon, cityName) => onLocationSelected(lat, lon, cityName)}
            onMapRefReady={(map) => setMapInstance(map)}
          />
          <div className="absolute bottom-2 left-2 bg-emerald-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-black border border-emerald-500/50 shadow-md z-30">
            📍 中央位置: {selectedMapCityName}
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold text-xs"
          >
            キャンセル
          </button>

          <button
            type="button"
            onClick={onConfirmLocation}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-lg transition transform active:scale-95 flex items-center space-x-1"
          >
            <span>📍 「{selectedMapCityName}」で位置決定・保存</span>
          </button>
        </div>
      </div>
    </div>
  );
}
