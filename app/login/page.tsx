"use client";

import { useState } from "react";
// 先ほど作った通信窓口を呼び出す
import { supabase } from "@/lib/supabase";


export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  // 新規登録（アカウント作成）
  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      setMessage("エラー: " + error.message);
    } else {
      setMessage("登録完了！続いて「ログイン」ボタンを押してください。");
    }
  };

  // ログイン処理
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setMessage("エラー: " + error.message);
    } else {
      setMessage("ログイン成功！これであなたは講師として認識されました！");
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-green-700 text-center">講師ログイン</h1>
      <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
        
        <input 
          type="email" 
          placeholder="メールアドレス（架空のものでOK）" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input 
          type="password" 
          placeholder="パスワード（6文字以上）" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded"
        />
        
        <div className="flex space-x-2 pt-2">
          <button 
            onClick={handleLogin} 
            className="w-full bg-green-500 text-white font-bold py-2 rounded hover:bg-green-600 transition"
          >
            ログイン
          </button>
          <button 
            onClick={handleSignUp} 
            className="w-full bg-gray-500 text-white font-bold py-2 rounded hover:bg-gray-600 transition"
          >
            新規登録
          </button>
        </div>

        {/* メッセージ表示エリア */}
        {message && (
          <p className="mt-4 text-sm font-bold text-blue-600 text-center bg-blue-50 p-2 rounded">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}