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
  const [isExiting, setIsExiting] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setIsExiting(false);
    }
  }

  useEffect(() => {
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
    };
  }, [isOpen, duration]);

  const handleClick = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
      setIsExiting(false);
      onCloseRef.current();
    }, FADE_OUT_DURATION_MS);
  };

  if (!isOpen && !isExiting) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={handleClick}
      className={`fixed bottom-6 left-1/2 z-[9999] bg-gray-900/95 text-white px-5 py-3 rounded-full shadow-2xl text-sm font-medium flex items-center space-x-2.5 backdrop-blur-md border border-gray-700/80 cursor-pointer select-none transition-shadow hover:shadow-emerald-950/40 ${
        isExiting ? 'animate-toast-out' : 'animate-toast-in'
      }`}
    >
      <svg
        className="w-5 h-5 text-emerald-400 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span className="leading-snug tracking-tight">{message}</span>
    </div>
  );
}
