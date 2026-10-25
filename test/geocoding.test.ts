import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchLocations, PREFECTURE_PRESETS } from '../components/ui/weather/geocoding';

describe('geocoding.ts - searchLocations', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('空文字や空白のみの場合は空配列を即座に返すこと', async () => {
    const res1 = await searchLocations('');
    const res2 = await searchLocations('   ');
    expect(res1).toEqual([]);
    expect(res2).toEqual([]);
  });

  it('47都道府県プリセット辞書に主要な都道府県が網羅されていること', () => {
    expect(PREFECTURE_PRESETS['千葉']).toBeDefined();
    expect(PREFECTURE_PRESETS['千葉'].lat).toBe(35.605);
    expect(PREFECTURE_PRESETS['千葉'].lon).toBe(140.1233);
    expect(PREFECTURE_PRESETS['東京']).toBeDefined();
    expect(PREFECTURE_PRESETS['大阪']).toBeDefined();
    expect(PREFECTURE_PRESETS['沖縄']).toBeDefined();
  });

  it('Open-Meteo直接検索で結果が返ってきた場合、整形して返すこと', async () => {
    const mockOpenMeteo = {
      results: [
        {
          name: '八王子市',
          admin1: '東京都',
          latitude: 35.6558,
          longitude: 139.3239,
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockOpenMeteo,
    } as Response);

    const results = await searchLocations('八王子市');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('東京都 八王子市');
    expect(results[0].lat).toBe(35.6558);
    expect(results[0].lon).toBe(139.3239);
  });

  it('Open-Meteo直接検索が0件でも、サフィックス補完（市など）で「千葉」を検索できること', async () => {
    // 1回目 (千葉直接): 0件
    // 2回目〜 (サフィックス候補): 千葉市でヒット
    global.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('name=%E5%8D%83%E8%91%89%E5%B8%82')) {
        // 千葉市
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              {
                name: '千葉市',
                admin1: '千葉県',
                latitude: 35.6,
                longitude: 140.1167,
              },
            ],
          }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ results: [] }),
      } as Response);
    });

    const results = await searchLocations('千葉');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('千葉県 千葉市');
    expect(results[0].lat).toBe(35.6);
    expect(results[0].lon).toBe(140.1167);
  });

  it('Open-Meteoが失敗または0件の場合、Nominatimにフォールバックすること', async () => {
    // Open-Meteo は全件0件
    global.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('nominatim.openstreetmap.org')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              lat: '35.6121',
              lon: '140.1141',
              display_name:
                '千葉, 駅前地下道, 新千葉一丁目, 中央区, 千葉市, 千葉県, 260-0015, 日本',
              name: '千葉',
            },
          ],
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ results: [] }),
      } as Response);
    });

    const results = await searchLocations('千葉');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain('千葉県 千葉市');
    expect(results[0].lat).toBe(35.6121);
    expect(results[0].lon).toBe(140.1141);
  });

  it('ネットワークエラーですべての外部APIが失敗した場合でも、都道府県プリセットから座標を取得できること', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const results = await searchLocations('千葉');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('千葉県 千葉市');
    expect(results[0].lat).toBe(35.605);
    expect(results[0].lon).toBe(140.1233);
  });
});
