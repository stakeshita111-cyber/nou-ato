export interface TaskItem {
  id: string;
  title: string;
  description: string;
  target_crop: string;
  exp: number;
  category?: string;
  status?: string;
}

export const MASTER_TASKS: TaskItem[] = [
  {
    id: "task_1",
    title: "トマトのわき芽かき＆支柱誘引",
    description: "主枝と葉の付け根から出てくる小さなわき芽を手で折り取る・主枝が倒れないよう紐で誘引する。",
    target_crop: "トマト",
    exp: 50,
    category: "work",
    status: "not_started",
  },
  {
    id: "task_2",
    title: "春野菜の土作り＆畝立て",
    description: "堆肥・元肥をすき込んで土を耕し、幅60cm・高さ15cmの畝を立てます。",
    target_crop: "土作り",
    exp: 40,
    category: "work",
    status: "not_started",
  },
  {
    id: "task_3",
    title: "ジャガイモの芽かき ＆ 第1回土寄せ",
    description: "草丈が10〜15cmになったら、元気な芽を1〜2本残して他を株元を押さえながら引き抜く",
    target_crop: "ジャガイモ",
    exp: 30,
    category: "work",
    status: "not_started",
  },
  {
    id: "task_4",
    title: "夏野菜の定植＆株元への追肥",
    description: "苗を植え穴に定植し、株元に肥料を元肥として適量施用します。",
    target_crop: "夏野菜全般",
    exp: 40,
    category: "work",
    status: "not_started",
  },
  {
    id: "task_5",
    title: "畑のタップリ水やり ＆ 雑草の除草作業",
    description: "株元を中心にしっかり水を与え、畝間や株元の雑草を手で丁寧に抜きます。",
    target_crop: "管理全般",
    exp: 20,
    category: "work",
    status: "not_started",
  },
];
