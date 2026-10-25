// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StudentTaskPreviewModal from '../components/templates/StudentTaskPreviewModal';
import BedApprovalModal from '../components/farm/BedApprovalModal';
import { TaskTemplate } from '@/lib/taskTemplates';
import { FarmPlot, FarmBed } from '@/types/farm';

const baseTemplate: TaskTemplate = {
  id: 'template-1',
  title: '畝立て作業',
  category: '土作り',
  target_crop: 'トマト',
  difficulty: 2,
  estimated_time: '30分',
  description: '1. 耕す\n2. 成形する',
  exp: 50,
  season: '春夏',
  phase: '準備・植付',
  tools_needed: 'スコップ',
  memo: '土をしっかり耕しましょう',
  require_photo: false,
  badge_name: '土作りマスター',
  badge_icon: '⛏️',
};

const mockPlot: FarmPlot = {
  id: 'plot-1',
  farm_id: 'farm-1',
  name: '区画A-1',
  code: 'A-1',
  student_id: 'student-1',
  student_name: '山田 太郎',
  grid_index: 0,
  position: { x: 0, y: 0 },
  beds: [],
};

const mockBed: FarmBed = {
  id: 'bed-1',
  plot_id: 'plot-1',
  bed_number: 1,
  crop_name: 'トマト',
  is_updated: false,
  status: 'completed_pending',
  completion_image_url: 'https://example.com/harvest.jpg',
  completion_notes: '美味しく実りました',
  total_harvest: '3kg',
};

describe('StudentTaskPreviewModal URL Protocol Security', () => {
  it('https: スキームのURLの場合は参考資料リンクを表示すること', async () => {
    const template: TaskTemplate = {
      ...baseTemplate,
      reference_links: 'https://example.com/guide',
    };

    await act(async () => {
      render(<StudentTaskPreviewModal template={template} isOpen={true} onClose={vi.fn()} />);
    });
    const link = screen.getByRole('link', { name: /参考資料・栽培マニュアルを見る/ });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('https://example.com/guide');
  });

  it('http: スキームのURLの場合は参考資料リンクを表示すること', async () => {
    const template: TaskTemplate = {
      ...baseTemplate,
      reference_links: 'http://example.com/guide',
    };

    await act(async () => {
      render(<StudentTaskPreviewModal template={template} isOpen={true} onClose={vi.fn()} />);
    });
    const link = screen.getByRole('link', { name: /参考資料・栽培マニュアルを見る/ });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('http://example.com/guide');
  });

  it('javascript: スキームのURLの場合は参考資料リンクを表示しないこと (XSS対策)', async () => {
    const template: TaskTemplate = {
      ...baseTemplate,
      reference_links: 'javascript:alert("XSS")',
    };

    await act(async () => {
      render(<StudentTaskPreviewModal template={template} isOpen={true} onClose={vi.fn()} />);
    });
    expect(screen.queryByRole('link', { name: /参考資料・栽培マニュアルを見る/ })).toBeNull();
  });

  it('不正な形式のURL文字列の場合は参考資料リンクを表示しないこと', async () => {
    const template: TaskTemplate = {
      ...baseTemplate,
      reference_links: 'not-a-valid-url',
    };

    await act(async () => {
      render(<StudentTaskPreviewModal template={template} isOpen={true} onClose={vi.fn()} />);
    });
    expect(screen.queryByRole('link', { name: /参考資料・栽培マニュアルを見る/ })).toBeNull();
  });
});

describe('BedApprovalModal Security & Exception Handling', () => {
  it('画像クリック時に noopener,noreferrer を指定して window.open を安全に呼び出すこと', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <BedApprovalModal
        isOpen={true}
        onClose={vi.fn()}
        plot={mockPlot}
        bed={mockBed}
        onApprove={vi.fn()}
      />
    );

    const img = screen.getByAltText('収穫記念写真');
    fireEvent.click(img);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://example.com/harvest.jpg',
      '_blank',
      'noopener,noreferrer'
    );
    windowOpenSpy.mockRestore();
  });

  it('handleApprove で非同期例外が発生してもログ出力し、ボタン状態を解除すること', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const errorApprove = vi.fn().mockRejectedValue(new Error('Approve error'));

    render(
      <BedApprovalModal
        isOpen={true}
        onClose={vi.fn()}
        plot={mockPlot}
        bed={mockBed}
        onApprove={errorApprove}
      />
    );

    const approveButtons = screen.getAllByRole('button', { name: /承認して新畝を追加/ });
    fireEvent.click(approveButtons[0]);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Approval modal error:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('handleReject で非同期例外が発生してもログ出力し、ボタン状態を解除すること', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const errorReject = vi.fn().mockRejectedValue(new Error('Reject error'));

    render(
      <BedApprovalModal
        isOpen={true}
        onClose={vi.fn()}
        plot={mockPlot}
        bed={mockBed}
        onApprove={vi.fn()}
        onReject={errorReject}
      />
    );

    const showRejectBtn = screen.getByRole('button', { name: /差し戻し/ });
    fireEvent.click(showRejectBtn);

    const confirmRejectBtn = screen.getByRole('button', { name: /差し戻しを実行する/ });
    fireEvent.click(confirmRejectBtn);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Approval modal error:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});
