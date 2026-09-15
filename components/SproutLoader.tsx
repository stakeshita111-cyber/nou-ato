import React from 'react';

interface SproutLoaderProps {
  /** ローダーの全体サイズ（px）。デフォルトは 72 */
  size?: number;
  /** 全画面中央配置にするかどうか。デフォルトは false */
  fullScreen?: boolean;
  /** 追加のclassName */
  className?: string;
}

/**
 * 農業テーマにぴったりの「土から芽が生えてくる」一体型ローディングアニメーション。
 * 絵文字ではなくSVGとCSSキーフレームで描画されているため、
 * 土と芽が分離せず、自然で愛らしい発芽の瞬間を表現します。
 */
export const SproutLoader: React.FC<SproutLoaderProps> = ({
  size = 72,
  fullScreen = false,
  className = '',
}) => {
  const content = (
    <div
      className={`relative flex items-center justify-center rounded-3xl bg-white shadow-md border border-emerald-100/80 p-2 select-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-label="読み込み中"
      role="status"
    >
      <style>{`
        @keyframes nouAtoSproutGrow {
          0% {
            transform: translateY(22px) scale(0.15);
            opacity: 0;
          }
          15% {
            transform: translateY(16px) scale(0.4);
            opacity: 1;
          }
          55% {
            transform: translateY(-3px) scale(1.08);
          }
          70% {
            transform: translateY(0px) scale(1);
          }
          85% {
            transform: translateY(0px) scale(1) rotate(2.5deg);
          }
          92% {
            transform: translateY(0px) scale(1) rotate(-2.5deg);
          }
          100% {
            transform: translateY(0px) scale(1) rotate(0deg);
          }
        }

        @keyframes nouAtoLeafLeft {
          0%, 20% {
            transform: scale(0) rotate(-40deg);
            opacity: 0;
          }
          40% {
            opacity: 1;
          }
          60% {
            transform: scale(1.1) rotate(5deg);
          }
          75%, 100% {
            transform: scale(1) rotate(0deg);
          }
        }

        @keyframes nouAtoLeafRight {
          0%, 25% {
            transform: scale(0) rotate(40deg);
            opacity: 0;
          }
          45% {
            opacity: 1;
          }
          65% {
            transform: scale(1.1) rotate(-5deg);
          }
          75%, 100% {
            transform: scale(1) rotate(0deg);
          }
        }

        @keyframes nouAtoSoilBump {
          0%, 10% {
            transform: scaleY(1);
          }
          20% {
            transform: scaleY(1.08) scaleX(1.02);
          }
          40% {
            transform: scaleY(0.96) scaleX(1.01);
          }
          60%, 100% {
            transform: scale(1);
          }
        }

        .nouato-sprout-group {
          transform-origin: 40px 58px;
          animation: nouAtoSproutGrow 2.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
        }
        .nouato-leaf-left {
          transform-origin: 40px 37px;
          animation: nouAtoLeafLeft 2.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
        }
        .nouato-leaf-right {
          transform-origin: 40px 39px;
          animation: nouAtoLeafRight 2.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
        }
        .nouato-soil-mound {
          transform-origin: 40px 65px;
          animation: nouAtoSoilBump 2.2s ease-in-out infinite;
        }
      `}</style>

      <svg
        width="100%"
        height="100%"
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        {/* 1. 地面の影 */}
        <ellipse cx="40" cy="63" rx="24" ry="7" fill="#5D4037" opacity="0.18" />

        {/* 2. 土の中から生えてくる芽（手前の土の奥に配置されるため、根元が土に潜り込んで自然に見える） */}
        <g className="nouato-sprout-group">
          {/* 茎 */}
          <path
            d="M 40 58 C 40 50 39.5 42 40 33"
            stroke="#4CAF50"
            strokeWidth="3.6"
            strokeLinecap="round"
          />

          {/* 左の若葉 */}
          <path
            className="nouato-leaf-left"
            d="M 40 37 C 31 36 25 28 29 23 C 35 20 40 29 40 37 Z"
            fill="#66BB6A"
          />

          {/* 右の若葉 */}
          <path
            className="nouato-leaf-right"
            d="M 40 39 C 49 38 55 30 51 25 C 45 22 40 31 40 39 Z"
            fill="#81C784"
          />

          {/* 葉の中心ハイライト */}
          <path
            d="M 40 37 C 35 31 32 26 31 24"
            stroke="#A5D6A7"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.75"
          />
        </g>

        {/* 3. 手前のふっくらした土の盛り上がり（芽の根本をしっかり覆う） */}
        <g className="nouato-soil-mound">
          <path
            d="M 18 64 C 22 54 32 52 40 52 C 48 52 58 54 62 64 C 64 67 61 70 54 71 C 45 72 35 72 26 71 C 19 70 16 67 18 64 Z"
            fill="#795548"
          />
          <path
            d="M 22 63 C 27 56 34 54 40 54 C 46 54 53 56 58 63 C 54 66 47 67 40 67 C 33 67 26 66 22 63 Z"
            fill="#8D6E63"
          />

          {/* 土のつぶつぶ（自然な質感） */}
          <circle cx="34" cy="62" r="1.3" fill="#A1887F" />
          <circle cx="45" cy="61" r="1.1" fill="#A1887F" />
          <circle cx="38" cy="64" r="1.1" fill="#5D4037" />
          <circle cx="28" cy="65" r="1.3" fill="#5D4037" />
          <circle cx="51" cy="64" r="1.4" fill="#A1887F" />
        </g>
      </svg>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-[#f7f9f5] flex items-center justify-center p-4 animate-fade-in">
        {content}
      </div>
    );
  }

  return content;
};
