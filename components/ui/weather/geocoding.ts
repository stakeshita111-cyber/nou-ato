import { z } from 'zod';

export interface SearchLocationResult {
  name: string;
  lat: number;
  lon: number;
}

const OpenMeteoItemSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  admin1: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
});

const OpenMeteoResponseSchema = z.object({
  results: z.array(OpenMeteoItemSchema).optional(),
});

const NominatimItemSchema = z.object({
  lat: z.string(),
  lon: z.string(),
  display_name: z.string(),
  name: z.string().optional(),
});

const NominatimResponseSchema = z.array(NominatimItemSchema);

/** 47都道府県の代表中心座標（オフライン・極限フォールバック用） */
export const PREFECTURE_PRESETS: Record<string, { lat: number; lon: number; name: string }> = {
  北海道: { lat: 43.0642, lon: 141.3469, name: '北海道 札幌市' },
  青森: { lat: 40.8244, lon: 140.74, name: '青森県 青森市' },
  青森県: { lat: 40.8244, lon: 140.74, name: '青森県 青森市' },
  岩手: { lat: 39.7036, lon: 141.1527, name: '岩手県 盛岡市' },
  岩手県: { lat: 39.7036, lon: 141.1527, name: '岩手県 盛岡市' },
  宮城: { lat: 38.2682, lon: 140.8694, name: '宮城県 仙台市' },
  宮城県: { lat: 38.2682, lon: 140.8694, name: '宮城県 仙台市' },
  秋田: { lat: 39.7186, lon: 140.1024, name: '秋田県 秋田市' },
  秋田県: { lat: 39.7186, lon: 140.1024, name: '秋田県 秋田市' },
  山形: { lat: 38.2404, lon: 140.3636, name: '山形県 山形市' },
  山形県: { lat: 38.2404, lon: 140.3636, name: '山形県 山形市' },
  福島: { lat: 37.7503, lon: 140.4676, name: '福島県 福島市' },
  福島県: { lat: 37.7503, lon: 140.4676, name: '福島県 福島市' },
  茨城: { lat: 36.3418, lon: 140.4468, name: '茨城県 水戸市' },
  茨城県: { lat: 36.3418, lon: 140.4468, name: '茨城県 水戸市' },
  栃木: { lat: 36.5657, lon: 139.8836, name: '栃木県 宇都宮市' },
  栃木県: { lat: 36.5657, lon: 139.8836, name: '栃木県 宇都宮市' },
  群馬: { lat: 36.3907, lon: 139.0604, name: '群馬県 前橋市' },
  群馬県: { lat: 36.3907, lon: 139.0604, name: '群馬県 前橋市' },
  埼玉: { lat: 35.857, lon: 139.6489, name: '埼玉県 さいたま市' },
  埼玉県: { lat: 35.857, lon: 139.6489, name: '埼玉県 さいたま市' },
  千葉: { lat: 35.605, lon: 140.1233, name: '千葉県 千葉市' },
  千葉県: { lat: 35.605, lon: 140.1233, name: '千葉県 千葉市' },
  東京: { lat: 35.6895, lon: 139.6917, name: '東京都 新宿区' },
  東京都: { lat: 35.6895, lon: 139.6917, name: '東京都 新宿区' },
  神奈川: { lat: 35.4478, lon: 139.6425, name: '神奈川県 横浜市' },
  神奈川県: { lat: 35.4478, lon: 139.6425, name: '神奈川県 横浜市' },
  新潟: { lat: 37.9022, lon: 139.0232, name: '新潟県 新潟市' },
  新潟県: { lat: 37.9022, lon: 139.0232, name: '新潟県 新潟市' },
  富山: { lat: 36.6953, lon: 137.2113, name: '富山県 富山市' },
  富山県: { lat: 36.6953, lon: 137.2113, name: '富山県 富山市' },
  石川: { lat: 36.5947, lon: 136.6256, name: '石川県 金沢市' },
  石川県: { lat: 36.5947, lon: 136.6256, name: '石川県 金沢市' },
  福井: { lat: 36.0652, lon: 136.2216, name: '福井県 福井市' },
  福井県: { lat: 36.0652, lon: 136.2216, name: '福井県 福井市' },
  山梨: { lat: 35.6639, lon: 138.5683, name: '山梨県 甲府市' },
  山梨県: { lat: 35.6639, lon: 138.5683, name: '山梨県 甲府市' },
  長野: { lat: 36.6513, lon: 138.181, name: '長野県 長野市' },
  長野県: { lat: 36.6513, lon: 138.181, name: '長野県 長野市' },
  岐阜: { lat: 35.3912, lon: 136.7223, name: '岐阜県 岐阜市' },
  岐阜県: { lat: 35.3912, lon: 136.7223, name: '岐阜県 岐阜市' },
  静岡: { lat: 34.9756, lon: 138.3828, name: '静岡県 静岡市' },
  静岡県: { lat: 34.9756, lon: 138.3828, name: '静岡県 静岡市' },
  愛知: { lat: 35.1802, lon: 136.9066, name: '愛知県 名古屋市' },
  愛知県: { lat: 35.1802, lon: 136.9066, name: '愛知県 名古屋市' },
  三重: { lat: 34.7303, lon: 136.5086, name: '三重県 津市' },
  三重県: { lat: 34.7303, lon: 136.5086, name: '三重県 津市' },
  滋賀: { lat: 35.0045, lon: 135.8686, name: '滋賀県 大津市' },
  滋賀県: { lat: 35.0045, lon: 135.8686, name: '滋賀県 大津市' },
  京都: { lat: 35.0212, lon: 135.7556, name: '京都府 京都市' },
  京都府: { lat: 35.0212, lon: 135.7556, name: '京都府 京都市' },
  大阪: { lat: 34.6863, lon: 135.52, name: '大阪府 大阪市' },
  大阪府: { lat: 34.6863, lon: 135.52, name: '大阪府 大阪市' },
  兵庫: { lat: 34.6913, lon: 135.183, name: '兵庫県 神戸市' },
  兵庫県: { lat: 34.6913, lon: 135.183, name: '兵庫県 神戸市' },
  奈良: { lat: 34.6853, lon: 135.8327, name: '奈良県 奈良市' },
  奈良県: { lat: 34.6853, lon: 135.8327, name: '奈良県 奈良市' },
  和歌山: { lat: 34.226, lon: 135.1675, name: '和歌山県 和歌山市' },
  和歌山県: { lat: 34.226, lon: 135.1675, name: '和歌山県 和歌山市' },
  鳥取: { lat: 35.5036, lon: 134.2383, name: '鳥取県 鳥取市' },
  鳥取県: { lat: 35.5036, lon: 134.2383, name: '鳥取県 鳥取市' },
  島根: { lat: 35.4723, lon: 133.0505, name: '島根県 松江市' },
  島根県: { lat: 35.4723, lon: 133.0505, name: '島根県 松江市' },
  岡山: { lat: 34.6618, lon: 133.935, name: '岡山県 岡山市' },
  岡山県: { lat: 34.6618, lon: 133.935, name: '岡山県 岡山市' },
  広島: { lat: 34.3963, lon: 132.4594, name: '広島県 広島市' },
  広島県: { lat: 34.3963, lon: 132.4594, name: '広島県 広島市' },
  山口: { lat: 34.186, lon: 131.4705, name: '山口県 山口市' },
  山口県: { lat: 34.186, lon: 131.4705, name: '山口県 山口市' },
  徳島: { lat: 34.0658, lon: 134.5594, name: '徳島県 徳島市' },
  徳島県: { lat: 34.0658, lon: 134.5594, name: '徳島県 徳島市' },
  香川: { lat: 34.3402, lon: 134.0434, name: '香川県 高松市' },
  香川県: { lat: 34.3402, lon: 134.0434, name: '香川県 高松市' },
  愛媛: { lat: 33.8417, lon: 132.7661, name: '愛媛県 松山市' },
  愛媛県: { lat: 33.8417, lon: 132.7661, name: '愛媛県 松山市' },
  高知: { lat: 33.5597, lon: 133.5311, name: '高知県 高知市' },
  高知県: { lat: 33.5597, lon: 133.5311, name: '高知県 高知市' },
  福岡: { lat: 33.6068, lon: 130.4181, name: '福岡県 福岡市' },
  福岡県: { lat: 33.6068, lon: 130.4181, name: '福岡県 福岡市' },
  佐賀: { lat: 33.2494, lon: 130.2988, name: '佐賀県 佐賀市' },
  佐賀県: { lat: 33.2494, lon: 130.2988, name: '佐賀県 佐賀市' },
  長崎: { lat: 32.7448, lon: 129.8737, name: '長崎県 長崎市' },
  長崎県: { lat: 32.7448, lon: 129.8737, name: '長崎県 長崎市' },
  熊本: { lat: 32.7898, lon: 130.7417, name: '熊本県 熊本市' },
  熊本県: { lat: 32.7898, lon: 130.7417, name: '熊本県 熊本市' },
  大分: { lat: 33.2382, lon: 131.6126, name: '大分県 大分市' },
  大分県: { lat: 33.2382, lon: 131.6126, name: '大分県 大分市' },
  宮崎: { lat: 31.9111, lon: 131.4239, name: '宮崎県 宮崎市' },
  宮崎県: { lat: 31.9111, lon: 131.4239, name: '宮崎県 宮崎市' },
  鹿児島: { lat: 31.5602, lon: 130.5581, name: '鹿児島県 鹿児島市' },
  鹿児島県: { lat: 31.5602, lon: 130.5581, name: '鹿児島県 鹿児島市' },
  沖縄: { lat: 26.2124, lon: 127.6809, name: '沖縄県 那覇市' },
  沖縄県: { lat: 26.2124, lon: 127.6809, name: '沖縄県 那覇市' },
};

function formatNominatimName(displayName: string): string {
  const parts = displayName.split(',').map((p) => p.trim());
  const filtered = parts.filter(
    (p) => p !== '日本' && !/^\d{3}-\d{4}$/.test(p) && !/^\d{5,}/.test(p)
  );
  const reversed = [...filtered].reverse();
  return reversed.slice(0, 3).join(' ') || parts[0] || displayName;
}

async function fetchOpenMeteo(query: string, count = 5): Promise<SearchLocationResult[]> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&language=ja&count=${count}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const rawData: unknown = await res.json();
    const parsed = OpenMeteoResponseSchema.safeParse(rawData);
    if (!parsed.success || !parsed.data.results || parsed.data.results.length === 0) {
      return [];
    }

    return parsed.data.results.map((item) => ({
      name: item.admin1 && item.admin1 !== item.name ? `${item.admin1} ${item.name}` : item.name,
      lat: Math.round(item.latitude * 10000) / 10000,
      lon: Math.round(item.longitude * 10000) / 10000,
    }));
  } catch {
    return [];
  }
}

async function fetchNominatim(query: string, limit = 5): Promise<SearchLocationResult[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=jp&format=json&accept-language=ja&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'NouAtoApp/1.0 (nou-ato)',
      },
    });
    if (!res.ok) return [];

    const rawData: unknown = await res.json();
    const parsed = NominatimResponseSchema.safeParse(rawData);
    if (!parsed.success || parsed.data.length === 0) {
      return [];
    }

    return parsed.data.map((item) => {
      const latNum = parseFloat(item.lat);
      const lonNum = parseFloat(item.lon);
      return {
        name: formatNominatimName(item.display_name),
        lat: Math.round((Number.isNaN(latNum) ? 0 : latNum) * 10000) / 10000,
        lon: Math.round((Number.isNaN(lonNum) ? 0 : lonNum) * 10000) / 10000,
      };
    });
  } catch {
    return [];
  }
}

function deduplicateLocations(items: SearchLocationResult[]): SearchLocationResult[] {
  const seenCoords = new Set<string>();
  const seenNames = new Set<string>();
  const unique: SearchLocationResult[] = [];

  for (const item of items) {
    const coordKey = `${item.lat.toFixed(3)},${item.lon.toFixed(3)}`;
    if (seenCoords.has(coordKey) || seenNames.has(item.name)) {
      continue;
    }
    seenCoords.add(coordKey);
    seenNames.add(item.name);
    unique.push(item);
  }

  return unique;
}

/**
 * 日本の地名・市区町村・都道府県を柔軟に検索する階層・統合型ジオコーディング関数
 *
 * 1. Open-Meteo 直接検索
 * 2. 日本語サフィックス補完 (市、区、町、村、県、都、府)
 * 3. OpenStreetMap Nominatim 検索 (駅名・ランドマーク・具体地点)
 * 4. 47都道府県プリセット辞書フォールバック
 */
export async function searchLocations(rawQuery: string): Promise<SearchLocationResult[]> {
  const query = rawQuery.trim();
  if (!query) return [];

  try {
    // 日本語サフィックス候補の準備
    const hasSuffix = /[市区町村都道府県]$/.test(query);
    const suffixPromises = !hasSuffix
      ? ['市', '区', '町', '村', '県', '都', '府'].map((s) => fetchOpenMeteo(query + s, 2))
      : [];

    // Open-Meteo直接、サフィックス補完、および Nominatim を並列実行して統合
    const [directResults, nominatimResults, suffixGroup] = await Promise.all([
      fetchOpenMeteo(query, 5),
      fetchNominatim(query, 5),
      Promise.all(suffixPromises).then((r) => r.flat()),
    ]);

    const combined = [...nominatimResults, ...directResults, ...suffixGroup];
    const deduped = deduplicateLocations(combined);
    if (deduped.length > 0) {
      return deduped.slice(0, 5);
    }
  } catch (err) {
    console.error('External geocoding failed, checking preset dictionary:', err);
  }

  // 47都道府県プリセット辞書フォールバック
  const preset = PREFECTURE_PRESETS[query];
  if (preset) {
    return [preset];
  }

  return [];
}
