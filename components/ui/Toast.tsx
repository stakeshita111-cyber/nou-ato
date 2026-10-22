'use client';

import { useEffect, useState, useRef } from 'react';

interface ToastProps {
  message: string;
  isOpen: boolean;
  onClose: () => void;
  duration?: number;
}

const FADE_OUT_DURATION_MS = 350;

export default function Toast({ message, isOpen, onClose, duration = 3000 }: ToastProps) {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevMessage, setPrevMessage] = useState(message);
  const [isExiting, setIsExiting] = useState(false);
  const onCloseRef = useRef(onClose);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  if (isOpen !== prevIsOpen || message !== prevMessage) {
    setPrevIsOpen(isOpen);
    setPrevMessage(message);
    if (isOpen) {
      setIsExiting(false);
    }
  }

  useEffect(() => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }

    if (!isOpen) return;

    const holdDuration = Math.max(duration - FADE_OUT_DURATION_MS, 800);

    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, holdDuration);

    const closeTimer = setTimeout(() => {
      setIsExiting(false);
      onCloseRef.current();
    }, duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
    };
  }, [isOpen, message, duration]);

  const handleClick = () => {
    if (isExiting) return;
    setIsExiting(true);
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      setIsExiting(false);
      onCloseRef.current();
      clickTimerRef.current = null;
    }, FADE_OUT_DURATION_MS);
  };

  if (!isOpen && !isExiting) return null;

  const isError =
    message.includes('❌') ||
    message.includes('失敗') ||
    message.includes('エラー') ||
    message.includes('Error');
  const isWarn = message.includes('⚠️') || message.includes('注意') || message.includes('警告');

  return (
    <div
      key={`${message}_${isOpen}`}
      role="status"
      aria-live="polite"
      onClick={handleClick}
      className={`fixed bottom-6 left-1/2 z-[9999] bg-gray-900/95 text-white px-5 py-3 rounded-full shadow-2xl text-sm font-medium flex items-center space-x-2.5 backdrop-blur-md border border-gray-700/80 cursor-pointer select-none transition-shadow hover:shadow-emerald-950/40 ${
        isExiting ? 'animate-toast-out' : 'animate-toast-in'
      }`}
    >
      {isError ? (
        <svg
          className="w-5 h-5 text-rose-400 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      ) : isWarn ? (
        <svg
          className="w-5 h-5 text-amber-400 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5 text-emerald-400 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      <span className="leading-snug tracking-tight">{message}</span>
    </div>
  );
}
