// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ArchivedCropsModal from '@/components/farm/ArchivedCropsModal';
import { FarmBed, CropRecord } from '@/types/farm';

describe('ArchivedCropsModal', () => {
  const mockBeds: FarmBed[] = [
    {
      id: 'bed-1',
      plot_id: 'plot-1',
      bed_number: 1,
      crop_name: 'トマト',
      season: '2026年 春夏',
      status: 'archived',
      harvested_at: '2026-06-01',
      total_harvest: '5kg',
      completion_notes: '美味しく育ちました',
      is_updated: false,
    },
    {
      id: 'bed-2',
      plot_id: 'plot-1',
      bed_number: 2,
      crop_name: 'ナス',
      season: '2025年 秋冬',
      status: 'archived',
      harvested_at: '2025-11-15',
      total_harvest: '3kg',
      completion_notes: '豊作でした',
      is_updated: false,
    },
  ];

  const mockRecords: CropRecord[] = [
    {
      id: 'rec-1',
      bed_id: 'bed-1',
      date: '2026-05-10',
      growth_stage: '開花・受粉',
      work_types: [],
      notes: '花が咲きました',
      created_at: '2026-05-10T10:00:00Z',
    },
    {
      id: 'rec-2',
      bed_id: 'bed-1',
      date: '2026-05-20',
      growth_stage: '果実肥大',
      work_types: [],
      notes: '実が大きくなってきました',
      created_at: '2026-05-20T10:00:00Z',
    },
    {
      id: 'rec-3',
      bed_id: 'bed-2',
      date: '2025-10-01',
      growth_stage: '本葉展開・つる伸び',
      work_types: [],
      notes: '順調です',
      created_at: '2025-10-01T10:00:00Z',
    },
  ];

  it('renders modal when isOpen is true and shows archived crops', () => {
    const handleClose = vi.fn();
    render(
      <ArchivedCropsModal
        isOpen={true}
        onClose={handleClose}
        archivedBeds={mockBeds}
        records={mockRecords}
      />
    );

    expect(screen.getByText('過去の作物・収穫アーカイブ')).toBeDefined();
    expect(screen.getByText('トマト')).toBeDefined();
    expect(screen.getByText('ナス')).toBeDefined();
  });

  it('filters beds by season dropdown selection', () => {
    render(
      <ArchivedCropsModal
        isOpen={true}
        onClose={() => {}}
        archivedBeds={mockBeds}
        records={mockRecords}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '2026年 春夏' } });

    expect(screen.getByText('トマト')).toBeDefined();
    expect(screen.queryByText('ナス')).toBeNull();
  });

  it('expands bed details and displays associated records from pre-grouped map', () => {
    render(
      <ArchivedCropsModal
        isOpen={true}
        onClose={() => {}}
        archivedBeds={mockBeds}
        records={mockRecords}
      />
    );

    // Click on tomato bed card header to expand
    fireEvent.click(screen.getByText('トマト'));

    expect(screen.getByText('美味しく育ちました')).toBeDefined();
    expect(screen.getByText('花が咲きました')).toBeDefined();
    expect(screen.getByText('実が大きくなってきました')).toBeDefined();
  });

  it('does not render when isOpen is false', () => {
    render(
      <ArchivedCropsModal
        isOpen={false}
        onClose={() => {}}
        archivedBeds={mockBeds}
        records={mockRecords}
      />
    );

    expect(screen.queryByText('過去の作物・収穫アーカイブ')).toBeNull();
  });
});
