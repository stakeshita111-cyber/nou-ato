"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";
import Link from "next/link";

interface FarmOption {
  id: string;
  name: string;
  owner_name?: string;
}

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const farmIdParam = searchParams.get("farm_id");

  // 農園選択・情報
  const [farmsList, setFarmsList] = useState<FarmOption[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>(farmIdParam || "tanaka_farm");
  const [farmName, setFarmName] = useState("たなか自然農園 (体験デモ)");
  const [teacherName, setTeacherName] = useState("田中 太郎");
  const [isDemo, setIsDemo] = useState(!farmIdParam);

  // 入力フォームステート
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [loading, setLoading] = useState(false);

  // Supabase から農園・講師情報をリアルタイム取得
  useEffect(() => {
    const fetchFarmsAndCurrent = async () => {
      try {
        // 1. 全登録農園リストの取得
        const { data: dbFarms } = await supabase.from("farms").select("*");

        if (dbFarms && dbFarms.length > 0) {
          const formattedFarms: FarmOption[] = dbFarms.map((f: any) => ({
            id: f.id,
            name: f.name || "自然農園",
            owner_name: f.owner_name || "講師",
          }));
          setFarmsList(formattedFarms);
        }

        // 2. URLパラメータ指定の農園を直検索 (最優先)
        if (farmIdParam) {
          const { data: farm, error: farmErr } = await supabase
            .from("farms")
            .select("*")
            .eq("id", farmIdParam)
            .single();

          if (!farmErr && farm) {
            setFarmName(farm.name || "自然農園");
            setSelectedFarmId(farm.id);
            setIsDemo(false);

            let teacherDisplayName = farm.owner_name || "";

            // owner_id があれば users テーブルからお名前を取得
            if (!teacherDisplayName && farm.owner_id) {
              const { data: ownerUser } = await supabase
                .from("users")
                .select("display_name, email")
                .eq("id", farm.owner_id)
                .single();

              if (ownerUser?.display_name) {
                teacherDisplayName = ownerUser.display_name;
              } else if (ownerUser?.email) {
                teacherDisplayName = ownerUser.email.split("@")[0];
              }
            }

            // それでも取得できない場合、DB上の講師ユーザー (role = 'teacher') を検索
            if (!teacherDisplayName) {
              const { data: teacherUser } = await supabase
                .from("users")
                .select("display_name, email")
                .eq("role", "teacher")
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

              if (teacherUser?.display_name) {
                teacherDisplayName = teacherUser.display_name;
              } else if (teacherUser?.email) {
                teacherDisplayName = teacherUser.email.split("@")[0];
              }
            }

            setTeacherName(teacherDisplayName || "");
            return;
          }
        }

        // 指定がない場合、または見つからない場合はデモ設定
        setFarmName("たなか自然農園 (体験デモ)");
        setTeacherName("田中 太郎");
        setIsDemo(true);
      } catch (err) {
        console.error("fetchFarmsAndCurrent error:", err);
      }
    };

    fetchFarmsAndCurrent();
  }, [farmIdParam]);

  // 手動で所属農園を切り替えた場合
  const handleFarmSelectChange = (farmId: string) => {
    setSelectedFarmId(farmId);
    if (farmId === "tanaka_farm") {
      setFarmName("たなか自然農園 (体験デモ)");
      setTeacherName("田中 太郎");
      setIsDemo(true);
    } else {
      const selected = farmsList.find((f) => f.id === farmId);
      if (selected) {
        setFarmName(selected.name);
        setTeacherName(selected.owner_name || "講師");
        setIsDemo(false);
      }
    }
  };

  // 1. LINEで登録して参加
  const handleLineSignUp = async () => {
    setLoading(true);
    try {
      const origin = window.location.origin;
      if (selectedFarmId) {
        localStorage.setItem("nouato_invite_farm_id", selectedFarmId);
        document.cookie = `nouato_invite_farm_id=${selectedFarmId}; path=/; max-age=3600`;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "custom:line" as any,
        options: {
          scopes: "openid profile email",
          redirectTo: `${origin}/auth/callback?next=/student/quests&farm_id=${encodeURIComponent(selectedFarmId)}`,
          queryParams: {
            farm_id: selectedFarmId,
          },
        },
      });

      if (error) {
        setToastMessage(`LINE登録エラー: ${error.message}`);
        setShowToast(true);
      }
    } catch (err: any) {
      setToastMessage(`エラーが発生しました: ${err.message || ""}`);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // 2. メールアドレスで登録
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setToastMessage("ユーザー名（お名前）を入力してください");
      setShowToast(true);
      return;
    }
    if (!email.trim() || !password) {
      setToastMessage("メールアドレスとパスワードを入力してください");
      setShowToast(true);
      return;
    }
    if (password.length < 6) {
      setToastMessage("パスワードは6文字以上で入力してください");
      setShowToast(true);
      return;
    }

    setLoading(true);

    try {
      // 1. まずログインを試行
      const { data: signInData, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (!loginError && signInData.user) {
        // ログイン成功時は農園IDと名前を補正更新
        await supabase.from("users").upsert([
          {
            id: signInData.user.id,
            email: email.trim(),
            display_name: name.trim() || signInData.user.email?.split("@")[0] || "受講生",
            role: "student",
            farm_id: selectedFarmId || "5cf1b060-8229-4669-85e6-3bfca5d04c6d",
          },
        ], { onConflict: "id" });
      } else {
        // 未登録（または初回）の場合は新規アカウント登録
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signUpError) {
          if (signUpError.message.includes("already registered") || signUpError.message.includes("already exists")) {
            setToastMessage("💡 このメールアドレスは既に登録されています。パスワードが正しいかご確認のうえログインいただくか、別のメールアドレスをご入力ください。");
          } else {
            setToastMessage(`登録エラー: ${signUpError.message}`);
          }
          setShowToast(true);
          setLoading(false);
          return;
        }

        const userId = authData?.user?.id || `user_${Date.now()}`;
        await supabase.from("users").upsert([
          {
            id: userId,
            email: email.trim(),
            display_name: name.trim(),
            role: "student",
            farm_id: selectedFarmId || "5cf1b060-8229-4669-85e6-3bfca5d04c6d",
          },
        ], { onConflict: "id" });
      }

      setToastMessage(`🎉 「${farmName}」への参加登録が完了しました！`);
      setShowToast(true);

      setTimeout(() => {
        router.push("/student/quests");
      }, 900);
    } catch (err: any) {
      setToastMessage("登録中にエラーが発生しました: " + (err.message || ""));
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9f5] flex flex-col items-center py-6 px-4 font-sans text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="w-full max-w-[390px] bg-white rounded-3xl shadow-xl border border-gray-200/90 overflow-hidden animate-fade-in">
        {/* 動的農園招待バナー (招待された農園名「〇〇農園へようこそ！」を表示) */}
        <div className="relative h-48 w-full bg-cover bg-center" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80')` }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex flex-col justify-end p-5 text-white">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="bg-emerald-700/90 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                {isDemo ? "体験デモ農園" : "招待された農園"}
              </span>
            </div>
            <h2 className="text-xl font-black leading-snug drop-shadow-md">
              {farmName}へようこそ！
            </h2>
            {teacherName && teacherName !== "講師" && teacherName !== "農園主" ? (
              <p className="text-[11px] text-gray-200 opacity-90 font-medium mt-0.5">
                👨‍🌾 担当講師: {teacherName} 先生
              </p>
            ) : (
              <p className="text-[11px] text-gray-200 opacity-90 font-medium mt-0.5">
                農跡(のうあと) - 体験農業支援ポータル
              </p>
            )}
          </div>
        </div>

        {/* コンテンツ本文 */}
        <div className="p-6 space-y-5">
          {/* 農園選択ドロップダウン (URL招待でない場合、実在の農園を選択可能) */}
          {!farmIdParam && farmsList.length > 0 && (
            <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-2xl space-y-1">
              <label className="block text-[11px] font-bold text-emerald-950">
                🌱 参加する農園を選択
              </label>
              <select
                value={selectedFarmId}
                onChange={(e) => handleFarmSelectChange(e.target.value)}
                className="w-full p-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none"
              >
                <option value="tanaka_farm">たなか自然農園 (体験デモ)</option>
                {farmsList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.owner_name} 先生)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* キャッチコピー */}
          <div className="text-center space-y-0.5">
            <h3 className="font-black text-gray-900 text-sm">農園に参加する</h3>
            <p className="text-[11px] text-gray-500 font-medium">
              アカウントを作成して、学習を始めましょう。
            </p>
          </div>

          {/* 💬 LINEで登録して参加 ボタン */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleLineSignUp}
              disabled={loading}
              className="w-full py-3.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold rounded-2xl shadow-sm transition transform active:scale-[0.99] flex items-center justify-center space-x-2 text-sm"
            >
              <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 5.82 2 10.53c0 4.23 3.6 7.78 8.47 8.41.33.07.78.22.89.5.1.26.07.67.03.94-.06.4-.28 1.57-.31 1.91-.05.57.26.56.55.37.29-.19 4.67-2.75 6.37-4.71C20.61 15.65 22 13.27 22 10.53 22 5.82 17.52 2 12 2z"/>
              </svg>
              <span>{loading ? "LINEへ接続中..." : "LINEで登録して参加"}</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-3 text-[10px] text-gray-400 font-bold">またはメールで登録</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>
          </div>

          {/* メールアドレスで登録フォーム */}
          <form onSubmit={handleEmailSignUp} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">
                ユーザー名
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="お名前を入力"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@nou-ato.com"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">
                パスワード
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8文字以上の半角英数字"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition pr-11 placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 text-sm font-bold"
                  title={showPassword ? "パスワードを非表示" : "パスワードを表示"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* メールで登録 → ボタン */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-bold rounded-full shadow-xs transition flex items-center justify-center space-x-1.5 text-xs mt-2"
            >
              <span>{loading ? "登録中..." : "メールで登録 →"}</span>
            </button>
          </form>

          {/* フッター注意書き */}
          <p className="text-[10px] text-center text-gray-400 leading-relaxed">
            登録することで、利用規約およびプライバシーポリシーに同意したことになります。
          </p>

          <div className="pt-1 text-center">
            <Link href="/login" className="text-xs text-[#1c4d21] font-bold hover:underline">
              すでにアカウントをお持ちの方はこちら (ログイン)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-500">読み込み中...</div>}>
      <InviteContent />
    </Suspense>
  );
}
