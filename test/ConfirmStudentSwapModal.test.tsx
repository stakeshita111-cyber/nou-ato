// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmStudentSwapModal from '@/components/teacher/farm-canvas/ConfirmStudentSwapModal';
import { FarmPlot } from '@/types/farm';

describe('ConfirmStudentSwapModal Component', () => {
  const samplePlot: FarmPlot = {
    id: 'plot-1',
    farm_id: 'farm-1',
    code: 'A1',
    name: '区画 A1',
    student_id: 'student-1',
    student_name: '田中 太郎',
    is_vacant: false,
    position: { x: 0, y: 0 },
    beds: [],
  };

  it('1. modalData が null の場合は何も描画しないこと', () => {
    const { container } = render(
      <ConfirmStudentSwapModal modalData={null} onClose={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('2. modalData がある場合、区画コード・現担当者・新担当者を表示すること', () => {
    render(
      <ConfirmStudentSwapModal
        modalData={{
          plot: samplePlot,
          newStudent: { name: '佐藤 次郎' },
        }}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText('担当受講生を変更しますか？')).toBeTruthy();
    expect(screen.getByText('区画 A1 の担当者を変更します。')).toBeTruthy();
    expect(screen.getAllByText(/田中 太郎/).length).toBe(2);
    expect(screen.getByText(/佐藤 次郎/)).toBeTruthy();
    expect(screen.getByText(/未割り当てリストへ戻ります/)).toBeTruthy();
  });

  it('3. キャンセルボタンをクリックすると onClose が呼ばれること', () => {
    const handleClose = vi.fn();
    render(
      <ConfirmStudentSwapModal
        modalData={{
          plot: samplePlot,
          newStudent: { name: '佐藤 次郎' },
        }}
        onClose={handleClose}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('4. 背景 backdrop をクリックすると onClose が呼ばれるが、モーダル内部クリックでは呼ばれないこと', () => {
    const handleClose = vi.fn();
    const { container } = render(
      <ConfirmStudentSwapModal
        modalData={{
          plot: samplePlot,
          newStudent: { name: '佐藤 次郎' },
        }}
        onClose={handleClose}
        onConfirm={vi.fn()}
      />
    );

    // モーダル内部のクリック (stopPropagation)
    const modalBox = screen
      .getByText('担当受講生を変更しますか？')
      .closest('div[class*="rounded-3xl"]');
    expect(modalBox).not.toBeNull();
    if (modalBox) {
      fireEvent.click(modalBox);
      expect(handleClose).not.toHaveBeenCalled();
    }

    // 外側の backdrop クリック
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('5. 「変更する」ボタンをクリックすると onConfirm が呼ばれること', () => {
    const handleConfirm = vi.fn();
    render(
      <ConfirmStudentSwapModal
        modalData={{
          plot: samplePlot,
          newStudent: { name: '佐藤 次郎' },
        }}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '変更する' }));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });
});
