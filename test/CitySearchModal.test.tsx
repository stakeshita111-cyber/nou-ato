// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CitySearchModal } from '../components/ui/weather/CitySearchModal';
import * as geocodingModule from '../components/ui/weather/geocoding';

// WeatherMapView は Leaflet 依存があるためモック
vi.mock('../components/ui/weather/WeatherMapView', () => ({
  WeatherMapView: ({ selectedLat, selectedLon }: { selectedLat: number; selectedLon: number }) => (
    <div data-testid="mock-weather-map">
      Map Center: {selectedLat}, {selectedLon}
    </div>
  ),
}));

describe('CitySearchModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    selectedMapLat: 35.6895,
    selectedMapLon: 139.6917,
    selectedMapCityName: '東京都新宿区',
    onLocationSelected: vi.fn(),
    onGetCurrentLocation: vi.fn(),
    onConfirmLocation: vi.fn(),
    setToastMessage: vi.fn(),
    setShowToast: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('isOpen が false のときは何も描画されないこと', () => {
    const { container } = render(<CitySearchModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('「千葉」と検索して結果が表示され、最初の候補で onLocationSelected が自動呼出されること', async () => {
    const searchSpy = vi.spyOn(geocodingModule, 'searchLocations').mockResolvedValueOnce([
      { name: '千葉県 千葉市', lat: 35.6, lon: 140.1167 },
      { name: '千葉県 船橋市', lat: 35.6947, lon: 139.9825 },
    ]);

    render(<CitySearchModal {...defaultProps} />);

    const input = screen.getByPlaceholderText(/市町村名・地域名/);
    const searchBtn = screen.getByRole('button', { name: /検索/ });

    fireEvent.change(input, { target: { value: '千葉' } });
    fireEvent.click(searchBtn);

    expect(searchSpy).toHaveBeenCalledWith('千葉');

    // 候補ボタンの出現を待機
    await waitFor(() => {
      expect(screen.getByText(/千葉県 千葉市/)).toBeDefined();
      expect(screen.getByText(/千葉県 船橋市/)).toBeDefined();
    });

    // 1件目が自動的に選択反映されること
    expect(defaultProps.onLocationSelected).toHaveBeenCalledWith(35.6, 140.1167, '千葉県 千葉市');
    expect(defaultProps.setToastMessage).toHaveBeenCalledWith(
      '✨ 「千葉県 千葉市」を表示しました（候補2件）'
    );
    expect(defaultProps.setShowToast).toHaveBeenCalledWith(true);

    // 2件目の「千葉県 船橋市」をクリックして選択できること
    fireEvent.click(screen.getByText(/千葉県 船橋市/));
    expect(defaultProps.onLocationSelected).toHaveBeenCalledWith(
      35.6947,
      139.9825,
      '千葉県 船橋市'
    );
    expect(defaultProps.setToastMessage).toHaveBeenCalledWith('📍 「千葉県 船橋市」へ移動しました');
  });

  it('検索結果が0件の場合にユーザーへガイダンス通知を行うこと', async () => {
    vi.spyOn(geocodingModule, 'searchLocations').mockResolvedValueOnce([]);

    render(<CitySearchModal {...defaultProps} />);

    const input = screen.getByPlaceholderText(/市町村名・地域名/);
    const searchBtn = screen.getByRole('button', { name: /検索/ });

    fireEvent.change(input, { target: { value: '存在しない架空の地名xyz' } });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(defaultProps.setToastMessage).toHaveBeenCalledWith(
        expect.stringContaining('該当する市町村が見つかりませんでした')
      );
      expect(defaultProps.setShowToast).toHaveBeenCalledWith(true);
    });
  });

  it('検索処理中に例外が発生した場合、エラー通知が表示されること', async () => {
    vi.spyOn(geocodingModule, 'searchLocations').mockRejectedValueOnce(new Error('Network error'));

    render(<CitySearchModal {...defaultProps} />);

    const input = screen.getByPlaceholderText(/市町村名・地域名/);
    const searchBtn = screen.getByRole('button', { name: /検索/ });

    fireEvent.change(input, { target: { value: '千葉' } });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(defaultProps.setToastMessage).toHaveBeenCalledWith(
        '⚠️ 検索中にエラーが発生しました。通信環境をご確認ください。'
      );
      expect(defaultProps.setShowToast).toHaveBeenCalledWith(true);
    });
  });
});
