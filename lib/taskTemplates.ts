export type TaskTemplate = {
  id: string;
  title: string;
  target_crop: string;
  estimated_time: string;
  tools_needed: string;
  description: string;
  memo: string;
  exp: number;
  difficulty: number;
  require_photo: boolean;
  badge_name: string;
  badge_icon: string;
  category: "根菜" | "果菜" | "葉菜" | "土作り";
};

export const VEGETABLE_TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "tpl_potato",
    title: "🥔 ジャガイモの芽かき＆第1回土寄せ",
    target_crop: "ジャガイモ",
    category: "根菜",
    estimated_time: "30分",
    tools_needed: "軍手, 肥料(化成8-8-8), クワまたはスコップ",
    description:
      "・草丈が10〜15cmになったら、元気な芽を1〜2本残して他を株元を押さえながら引き抜く\n・株元に化成肥料をひと摘み(約10g)施す\n・イモが日光に当たって緑化しないよう、株元に5cmほど土を寄せる",
    memo: "芽を引き抜く時は、種イモごと抜け上がらないように片手でしっかり地面を押さえてね！",
    exp: 50,
    difficulty: 2,
    require_photo: true,
    badge_name: "芽かきプロ",
    badge_icon: "✂️",
  },
  {
    id: "tpl_tomato",
    title: "🍅 トマトのわき芽かき＆支柱誘引",
    target_crop: "トマト",
    category: "果菜",
    estimated_time: "20分",
    tools_needed: "剪定バサミ, 消毒液, 麻紐または誘引クリップ, 支柱",
    description:
      "・主枝と葉の付け根から出てくる小さなわき芽を手で折り取る\n・ハサミを使う場合はウイルス感染を防ぐため毎回アルコール消毒する\n・主枝が倒れないよう、8の字結びで支柱に緩く固定する",
    memo: "わき芽は小さいうちに手で摘み取るのが一番傷口が小さくて安全だよ！",
    exp: 60,
    difficulty: 2,
    require_photo: true,
    badge_name: "わき芽ハンター",
    badge_icon: "✂️",
  },
  {
    id: "tpl_komatsuna",
    title: "🥬 コマツナの間引き＆第1回追肥",
    target_crop: "コマツナ・葉物",
    category: "葉菜",
    estimated_time: "15分",
    tools_needed: "軍手, 液体肥料または化成肥料, ジョウロ",
    description:
      "・本葉が2〜3枚になったら、株間が3〜4cmになるよう混み合った苗を間引く\n・間引いた若い苗はサラダやお味噌汁にして食べられます\n・株元に軽く追肥を行い、薄めた液肥を与える",
    memo: "間引き苗は「ベビーリーフ」としてとっても美味しいよ！しっかり食べて観察しよう。",
    exp: 40,
    difficulty: 1,
    require_photo: false,
    badge_name: "間引き名人",
    badge_icon: "🌱",
  },
  {
    id: "tpl_nasu",
    title: "🍆 ナスの3本仕立て＆フラワーネット張り",
    target_crop: "ナス・ピーマン",
    category: "果菜",
    estimated_time: "40分",
    tools_needed: "支柱3本, 誘引テープ, ハサミ, 肥料",
    description:
      "・一番最初についた花（一番花）のすぐ下の強いわき芽2本と主枝を残して「3本仕立て」にする\n・それより下の細かいわき芽はすべて摘み取る\n・支柱を3本合掌型に立てて主枝と側枝を固定する",
    memo: "ナスは水と肥料が大好き！仕立てをしっかり行うと秋まで長く収穫できるよ。",
    exp: 70,
    difficulty: 3,
    require_photo: true,
    badge_name: "ナス仕立てマスター",
    badge_icon: "🍆",
  },
  {
    id: "tpl_soil",
    title: "🌱 春野菜の土作り＆高畝(たかうね)立て",
    target_crop: "共通・土作り",
    category: "土作り",
    estimated_time: "60分",
    tools_needed: "苦土石灰, 完熟牛ふん堆肥, 化成肥料, 鍬(クワ), レーキ",
    description:
      "・植え付け2週間前に苦土石灰(100g/㎡)を撒いて深く耕す\n・1週間前に牛ふん堆肥(2kg/㎡)と化成肥料(100g/㎡)を混ぜ込む\n・水はけを良くするため幅60cm・高さ15〜20cmの平畝を作る",
    memo: "土作りは栽培の8割を決める大切なステップ！ふかふかの土を目指そう。",
    exp: 80,
    difficulty: 3,
    require_photo: true,
    badge_name: "土作りマシーン",
    badge_icon: "🚜",
  },
];
