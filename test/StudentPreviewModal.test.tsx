// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StudentPreviewModal, { StudentPreviewData } from '../components/teacher/StudentPreviewModal';

const sampleStudent: StudentPreviewData = {
  id: 'student-123',
  name: '山田 太郎',
  avatar: '山田',
  avatarBg: 'bg-emerald-800 text-white',
  plot: '区画 A1',
  step: '基礎作業中 🌿',
  progress: 40,
  completedCount: 2,
  totalTaskCount: 5,
  unreadCount: 0,
  lastReport: '2026/03/30',
  hasOverdue: false,
  activeTask: {
    title: '土づくり・畝立て',
    description: 'クワを使って畝を高く成形します',
    target_crop: 'トマト',
    exp: 50,
  },
  lastJournal: {
    content: '元気に発芽しました！',
    photo_url: 'https://example.com/journal.jpg',
    created_at: '2026/03/30',
  },
};

describe('StudentPreviewModal Component', () => {
  it('生徒情報および進行中タスク・日誌データを正しくレンダリングすること', () => {
    render(<StudentPreviewModal student={sampleStudent} onClose={vi.fn()} />);

    expect(screen.getByText('📱 生徒画面プレビュー (山田 太郎)')).toBeDefined();
    expect(screen.getByText('40% 完了 (2/5件完了)')).toBeDefined();
    expect(screen.getByText('土づくり・畝立て')).toBeDefined();
    expect(screen.getByText('クワを使って畝を高く成形します')).toBeDefined();
  });

  it('onAssignTask ハンドラーが渡されている場合、個別タスク配信ボタンを表示し、クリック時にコールバックを呼び出すこと', () => {
    const handleAssignTask = vi.fn();
    render(
      <StudentPreviewModal
        student={sampleStudent}
        onClose={vi.fn()}
        onAssignTask={handleAssignTask}
      />
    );

    const assignBtn = screen.getByText('この生徒に個別タスクを配信');
    expect(assignBtn).toBeDefined();

    fireEvent.click(assignBtn);
    expect(handleAssignTask).toHaveBeenCalledTimes(1);
    expect(handleAssignTask).toHaveBeenCalledWith(sampleStudent);
  });

  it('onAssignTask ハンドラーが渡されていない場合、個別タスク配信ボタンが表示されないこと (後方互換性)', () => {
    render(<StudentPreviewModal student={sampleStudent} onClose={vi.fn()} />);

    expect(screen.queryByText('この生徒に個別タスクを配信')).toBeNull();
  });

  it('onDeleteStudent ハンドラーが渡されている場合、削除ボタンをクリックするとコールバックが発火すること', () => {
    const handleDelete = vi.fn();
    render(
      <StudentPreviewModal
        student={sampleStudent}
        onClose={vi.fn()}
        onDeleteStudent={handleDelete}
      />
    );

    const deleteBtn = screen.getByText('この受講生を退会・農園から削除');
    expect(deleteBtn).toBeDefined();

    fireEvent.click(deleteBtn);
    expect(handleDelete).toHaveBeenCalledTimes(1);
    expect(handleDelete).toHaveBeenCalledWith(sampleStudent);
  });

  it('閉じるボタンをクリックすると onClose コールバックが発火すること', () => {
    const handleClose = vi.fn();
    render(<StudentPreviewModal student={sampleStudent} onClose={handleClose} />);

    const closeBtn = screen.getByText('プレビューを閉じる');
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
