// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Toast from '@/components/ui/Toast';

describe('Toast Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('isOpen が false の場合は何も描画しないこと', () => {
    const { container } = render(
      <Toast message="テストメッセージ" isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('isOpen が true の場合、メッセージを描画し animate-toast-in クラスが適用されること', () => {
    render(<Toast message="保存が完了しました" isOpen={true} onClose={vi.fn()} />);

    const toastElement = screen.getByRole('status');
    expect(toastElement).toBeDefined();
    expect(screen.getByText('保存が完了しました')).toBeDefined();
    expect(toastElement.className).toContain('animate-toast-in');
    expect(toastElement.className).not.toContain('animate-toast-out');
  });

  it('duration が経過する直前に animate-toast-out へ遷移し、完了時に onClose が呼ばれること', () => {
    const handleClose = vi.fn();
    render(<Toast message="通知メッセージ" isOpen={true} onClose={handleClose} duration={3000} />);

    const toastElement = screen.getByRole('status');
    expect(toastElement.className).toContain('animate-toast-in');

    // duration - 350ms (2650ms) 経過で退出アニメーション開始
    act(() => {
      vi.advanceTimersByTime(2700);
    });

    expect(toastElement.className).toContain('animate-toast-out');
    expect(handleClose).not.toHaveBeenCalled();

    // 3000ms 経過で onClose 実行
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('トーストをクリックすると即座に退出アニメーションを開始し、onClose が呼ばれること', () => {
    const handleClose = vi.fn();
    render(
      <Toast message="クリックで閉じる通知" isOpen={true} onClose={handleClose} duration={5000} />
    );

    const toastElement = screen.getByRole('status');
    expect(toastElement.className).toContain('animate-toast-in');

    // クリック
    fireEvent.click(toastElement);

    expect(toastElement.className).toContain('animate-toast-out');
    expect(handleClose).not.toHaveBeenCalled();

    // 退出アニメーション (350ms) 経過で onClose 実行
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
