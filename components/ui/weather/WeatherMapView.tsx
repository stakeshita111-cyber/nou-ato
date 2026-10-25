'use client';

import { useEffect, useRef } from 'react';
import { z } from 'zod';
import type { LeafletGlobal, LeafletMapInstance } from './types';
import { fetchMunicipalityNameFromCoords } from './useWeatherLive';

declare global {
  interface Window {
    L?: LeafletGlobal;
  }
}

const locationChangeSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  cityName: z.string(),
});

interface WeatherMapViewProps {
  isOpen: boolean;
  selectedLat: number;
  selectedLon: number;
  onLocationChange: (lat: number, lon: number, cityName: string) => void;
  onMapRefReady?: (mapInstance: LeafletMapInstance | null) => void;
}

export function WeatherMapView({
  isOpen,
  selectedLat,
  selectedLon,
  onLocationChange,
  onMapRefReady,
}: WeatherMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<LeafletMapInstance | null>(null);
  const isInternalMoveRef = useRef(false);

  // マップ初期化・破棄 (モーダルの開閉に連動)
  useEffect(() => {
    const initCenterPinMap = () => {
      const L = window.L;
      if (!L || !mapContainerRef.current) return;

      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
      }).setView([selectedLat, selectedLon], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      leafletMapRef.current = map;
      if (onMapRefReady) {
        onMapRefReady(map);
      }

      let timer: ReturnType<typeof setTimeout> | undefined;
      map.on('moveend', () => {
        if (isInternalMoveRef.current) {
          isInternalMoveRef.current = false;
          return;
        }

        clearTimeout(timer);
        timer = setTimeout(() => {
          const center = map.getCenter();
          const cLat = Math.round(center.lat * 10000) / 10000;
          const cLon = Math.round(center.lng * 10000) / 10000;

          fetchMunicipalityNameFromCoords(cLat, cLon)
            .then((cityName) => {
              const validated = locationChangeSchema.safeParse({ lat: cLat, lon: cLon, cityName });
              if (validated.success) {
                onLocationChange(validated.data.lat, validated.data.lon, validated.data.cityName);
              } else {
                onLocationChange(cLat, cLon, cityName);
              }
            })
            .catch((err: unknown) => {
              console.error('Failed to fetch municipality name from coords:', err);
            });
        }, 300);
      });
    };

    if (isOpen && mapContainerRef.current) {
      if (!window.L) {
        const existingLink = document.querySelector('link[href*="leaflet"]');
        if (!existingLink) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        const existingScript = document.querySelector('script[src*="leaflet"]');
        if (!existingScript) {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => initCenterPinMap();
          document.body.appendChild(script);
        } else {
          existingScript.addEventListener('load', () => initCenterPinMap(), { once: true });
        }
      } else {
        initCenterPinMap();
      }
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        if (onMapRefReady) {
          onMapRefReady(null);
        }
      }
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // 親から selectedLat / selectedLon が更新された場合にマップ中心を同期
  useEffect(() => {
    if (!leafletMapRef.current) return;
    const center = leafletMapRef.current.getCenter();
    const diffLat = Math.abs(center.lat - selectedLat);
    const diffLon = Math.abs(center.lng - selectedLon);
    // 0.0005 (約50m) 以上の乖離がある場合のみ外部指示による移動として反映
    if (diffLat > 0.0005 || diffLon > 0.0005) {
      isInternalMoveRef.current = true;
      leafletMapRef.current.setView([selectedLat, selectedLon], 12);
    }
  }, [selectedLat, selectedLon]);

  return (
    <div className="relative w-full h-52 sm:h-64 rounded-2xl overflow-hidden border border-gray-300 shadow-inner bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* 地図中央の赤ピンガイド (D&D位置合わせ用) */}
      <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center pb-6">
        <div className="flex flex-col items-center animate-bounce">
          <span className="text-3xl drop-shadow-md">📍</span>
          <span className="bg-gray-900/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow border border-emerald-400">
            農園位置を中央へ合わせる
          </span>
        </div>
      </div>
    </div>
  );
}
