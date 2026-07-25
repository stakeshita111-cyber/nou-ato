// components/ui/Badge.tsx
export default function Badge({ type, children }: { type: "exp" | "difficulty" | "time" | "crop", children: React.ReactNode }) {
  // typeごとに色を決定する
  const colorClass = {
    exp: "bg-blue-100 text-blue-800",       // 変更したい時はここだけ直せばOK！
    difficulty: "bg-orange-100 text-orange-800",
    time: "bg-gray-100 text-gray-800",
    crop: "bg-green-100 text-green-800"
  }[type];

  return (
    <span className={`text-sm px-3 py-1 rounded-full font-bold ${colorClass}`}>
      {children}
    </span>
  );
}