// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FarmCanvasToolbar, {
  FarmCanvasToolbarProps,
} from '@/components/teacher/farm-canvas/FarmCanvasToolbar';
import { useFarmStore } from '@/store/useFarmStore';
import { Farm } from '@/types/farm';

describe('FarmCanvasToolbar Component', () => {
  const dummyFarms: Farm[] = [
    { id: 'farm_1', name: '横浜第1農園' },
    { id: 'farm_2', name: '町田第2農園' },
    { id: 'farm_3', name: '' },
  ];

  let props: FarmCanvasToolbarProps;

  beforeEach(() => {
    vi.clearAllMocks();
    useFarmStore.setState({
      farms: dummyFarms,
      activeFarmId: 'farm_1',
      activeFarmName: '横浜第1農園',
      isLoading: false,
      loadError: null,
    });

    props = {
      farmSwitch: {
        farms: dummyFarms,
        activeFarmId: 'farm_1',
        setActiveFarmId: vi.fn().mockResolvedValue(undefined),
      },
      grid: {
        gridCols: 6,
        gridRows: 4,
        onGridColsChange: vi.fn(),
        onGridRowsChange: vi.fn(),
      },
      unassignedBeds: {
        count: 2,
        setCount: vi.fn(),
        updateAllUnassignedBedsCount: vi.fn().mockResolvedValue(true),
      },
      zoom: {
        zoomLevel: 100,
        setZoomLevel: vi.fn(),
      },
      notify: vi.fn(),
      openFarmSettingsModal: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('1. 正常系: 初期プロパティ（農園一覧・サイズ・未割当畝数・ズーム率）が正しく描画されること', () => {
    render(<FarmCanvasToolbar {...props} />);

    // 農園
    const selects = screen.getAllByRole('combobox');
    const farmSelect = selects[0] as HTMLSelectElement;
    expect(farmSelect.value).toBe('farm_1');
    expect(screen.getByText('横浜第1農園')).toBeTruthy();
    expect(screen.getByText('町田第2農園')).toBeTruthy();

    // 畑サイズ
    const colsSelect = screen.getByLabelText('列 (A-L):') as HTMLSelectElement;
    expect(colsSelect.value).toBe('6');

    const rowsSelect = screen.getByLabelText('行 (1-12):') as HTMLSelectElement;
    expect(rowsSelect.value).toBe('4');

    // 未割当畝数
    expect(screen.getByText('2 畝')).toBeTruthy();

    // ズーム
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('2. 正常系: 農園セレクトを変更したとき、setActiveFarmId・useFarmStore同期・notifyが呼ばれること', async () => {
    render(<FarmCanvasToolbar {...props} />);

    const selects = screen.getAllByRole('combobox');
    const farmSelect = selects[0]; // 対象農園 select

    fireEvent.change(farmSelect, { target: { value: 'farm_2' } });

    await waitFor(() => {
      expect(props.farmSwitch.setActiveFarmId).toHaveBeenCalledWith('farm_2');
      expect(useFarmStore.getState().activeFarmId).toBe('farm_2');
      expect(props.notify).toHaveBeenCalledWith('農園「町田第2農園」に切り替えました');
    });
  });

  it('3. 正常系: 農園名が空の農園に切り替えた場合、selectedId で notify されること', async () => {
    render(<FarmCanvasToolbar {...props} />);

    const selects = screen.getAllByRole('combobox');
    const farmSelect = selects[0];

    fireEvent.change(farmSelect, { target: { value: 'farm_3' } });

    await waitFor(() => {
      expect(props.farmSwitch.setActiveFarmId).toHaveBeenCalledWith('farm_3');
      expect(useFarmStore.getState().activeFarmId).toBe('farm_3');
      expect(props.notify).toHaveBeenCalledWith('農園「farm_3」に切り替えました');
    });
  });

  it('4. 正常系: 設定ボタンをクリックしたとき、openFarmSettingsModal が呼ばれること', () => {
    render(<FarmCanvasToolbar {...props} />);

    const settingsButton = screen.getByRole('button', { name: /設定/ });
    fireEvent.click(settingsButton);

    expect(props.openFarmSettingsModal).toHaveBeenCalledTimes(1);
  });

  it('5. 正常系: 畑サイズ（列・行）セレクトを変更したとき、コールバックが正しい数値で呼ばれること', () => {
    render(<FarmCanvasToolbar {...props} />);

    const colsSelect = screen.getByLabelText('列 (A-L):');
    fireEvent.change(colsSelect, { target: { value: '8' } });
    expect(props.grid.onGridColsChange).toHaveBeenCalledWith(8);

    const rowsSelect = screen.getByLabelText('行 (1-12):');
    fireEvent.change(rowsSelect, { target: { value: '6' } });
    expect(props.grid.onGridRowsChange).toHaveBeenCalledWith(6);
  });

  it('6. 正常系: 未割当畝数を変更したとき、setCount・updateAllUnassignedBedsCount・notifyが呼ばれること', async () => {
    render(<FarmCanvasToolbar {...props} />);

    const selects = screen.getAllByRole('combobox');
    // 未割当畝数 select は 4つ目の combobox (農園, 列, 行, 畝数)
    const bedsCountSelect = selects[3];

    fireEvent.change(bedsCountSelect, { target: { value: '5' } });

    expect(props.unassignedBeds.setCount).toHaveBeenCalledWith(5);

    await waitFor(() => {
      expect(props.unassignedBeds.updateAllUnassignedBedsCount).toHaveBeenCalledWith(5);
      expect(props.notify).toHaveBeenCalledWith(
        '✨ すべての未割り当て区画の畝数を一括で「5 畝」に変更しました！'
      );
    });
  });

  it('7. 異常系: 未割当畝数に 0 以下の値が渡された場合、更新処理が実行されないこと', async () => {
    render(<FarmCanvasToolbar {...props} />);

    const selects = screen.getAllByRole('combobox');
    const bedsCountSelect = selects[3];

    fireEvent.change(bedsCountSelect, { target: { value: '0' } });

    expect(props.unassignedBeds.setCount).not.toHaveBeenCalled();
    expect(props.unassignedBeds.updateAllUnassignedBedsCount).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it('8. 正常系 & 境界値: ズームボタン操作で setZoomLevel の更新関数が正しく呼ばれること', () => {
    render(<FarmCanvasToolbar {...props} />);

    const minusButton = screen.getByRole('button', { name: '－' });
    const plusButton = screen.getByRole('button', { name: '＋' });

    // ズームイン (+)
    fireEvent.click(plusButton);
    expect(props.zoom.setZoomLevel).toHaveBeenCalledTimes(1);
    const plusUpdater = (props.zoom.setZoomLevel as ReturnType<typeof vi.fn>).mock.calls[0][0] as (
      prev: number
    ) => number;
    expect(plusUpdater(100)).toBe(110);
    expect(plusUpdater(200)).toBe(200); // 最大200%の上限境界値
    expect(plusUpdater(195)).toBe(200);

    // ズームアウト (-)
    fireEvent.click(minusButton);
    expect(props.zoom.setZoomLevel).toHaveBeenCalledTimes(2);
    const minusUpdater = (props.zoom.setZoomLevel as ReturnType<typeof vi.fn>).mock.calls[1][0] as (
      prev: number
    ) => number;
    expect(minusUpdater(100)).toBe(90);
    expect(minusUpdater(40)).toBe(40); // 最小40%の下限境界値
    expect(minusUpdater(45)).toBe(40);
  });
});
