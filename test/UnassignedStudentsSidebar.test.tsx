// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import UnassignedStudentsSidebar, {
  UnassignedStudentsSidebarProps,
} from '@/components/teacher/farm-canvas/UnassignedStudentsSidebar';
import { UnassignedStudent } from '@/hooks/farm/useStudentDrag';

describe('UnassignedStudentsSidebar Component', () => {
  const dummyStudents: UnassignedStudent[] = [
    { id: 'student_1', name: '佐藤 健', initials: 'ST', grade: '一般', colorBg: 'bg-blue-500' },
    {
      id: 'student_2',
      name: '鈴木 花子',
      initials: 'SH',
      grade: 'マスター',
      colorBg: 'bg-green-500',
    },
    { id: 'student_3', name: '高橋 雄大', initials: 'TY', grade: '一般', colorBg: 'bg-purple-500' },
    {
      id: 'student_4',
      name: '田中 美咲',
      initials: 'TM',
      grade: 'エキスパート',
      colorBg: 'bg-amber-500',
    },
    { id: 'student_5', name: '渡辺 翔太', initials: 'WS', grade: '一般', colorBg: 'bg-rose-500' },
    { id: 'student_6', name: '伊藤 さくら', initials: 'IS', grade: '一般', colorBg: 'bg-teal-500' },
  ];

  let props: UnassignedStudentsSidebarProps;

  beforeEach(() => {
    vi.clearAllMocks();
    props = {
      unassignedList: dummyStudents,
      draggingStudent: null,
      onDragStart: vi.fn(),
      onDragEnd: vi.fn(),
      onAssignAll: vi.fn(),
    };
  });

  it('1. 正常系: 未割り当て受講生が0人の場合、完了メッセージが表示され一括割当ボタンや検索が表示されないこと', () => {
    render(<UnassignedStudentsSidebar {...props} unassignedList={[]} />);

    expect(screen.getByText('0 名')).toBeTruthy();
    expect(screen.getByText('✨ すべての受講生が畑の区画に割り当てられています。')).toBeTruthy();
    expect(screen.queryByText('空き区画へ一括割り当て')).toBeNull();
    expect(screen.queryByPlaceholderText('受講生を検索...')).toBeNull();
  });

  it('2. 正常系: 受講生一覧が表示され、受講生数・名前・学年が表示されること', () => {
    render(<UnassignedStudentsSidebar {...props} />);

    expect(screen.getByText('6 名')).toBeTruthy();
    expect(screen.getByText('佐藤 健')).toBeTruthy();
    expect(screen.getByText('鈴木 花子')).toBeTruthy();
    expect(screen.getByText('マスター')).toBeTruthy();
    expect(screen.getByRole('button', { name: /空き区画へ一括割り当て/ })).toBeTruthy();
    expect(screen.getByPlaceholderText('受講生を検索...')).toBeTruthy();
  });

  it('3. 正常系: 5名以下の場合は検索バーが表示されないこと', () => {
    render(<UnassignedStudentsSidebar {...props} unassignedList={dummyStudents.slice(0, 5)} />);

    expect(screen.getByText('5 名')).toBeTruthy();
    expect(screen.queryByPlaceholderText('受講生を検索...')).toBeNull();
  });

  it('4. 正常系: 検索バーに入力した際、名前または学年でフィルタリングされること', () => {
    render(<UnassignedStudentsSidebar {...props} />);

    const searchInput = screen.getByPlaceholderText('受講生を検索...');

    // 名前で検索
    fireEvent.change(searchInput, { target: { value: '花子' } });
    expect(screen.getByText('鈴木 花子')).toBeTruthy();
    expect(screen.queryByText('佐藤 健')).toBeNull();

    // 学年で検索
    fireEvent.change(searchInput, { target: { value: 'エキスパート' } });
    expect(screen.getByText('田中 美咲')).toBeTruthy();
    expect(screen.queryByText('鈴木 花子')).toBeNull();

    // 一致なし
    fireEvent.change(searchInput, { target: { value: '該当なし' } });
    expect(screen.getByText('検索条件に一致する受講生はいません。')).toBeTruthy();
  });

  it('5. 正常系: カードのドラッグ開始時に dataTransfer がセットされ onDragStart が呼ばれること', () => {
    render(<UnassignedStudentsSidebar {...props} />);

    const studentCard = screen.getByText('佐藤 健').closest('div[draggable="true"]')!;
    const setDataMock = vi.fn();

    fireEvent.dragStart(studentCard, {
      dataTransfer: {
        setData: setDataMock,
        effectAllowed: '',
      },
    });

    expect(setDataMock).toHaveBeenCalledWith('application/json', JSON.stringify(dummyStudents[0]));
    expect(props.onDragStart).toHaveBeenCalledWith(dummyStudents[0]);
  });

  it('6. 正常系: カードのドラッグ終了時に onDragEnd が呼ばれること', () => {
    render(<UnassignedStudentsSidebar {...props} />);

    const studentCard = screen.getByText('佐藤 健').closest('div[draggable="true"]')!;
    fireEvent.dragEnd(studentCard);

    expect(props.onDragEnd).toHaveBeenCalledTimes(1);
  });

  it('7. 正常系: draggingStudent と一致するカードに半透明ハイライトのクラスが付与されること', () => {
    render(<UnassignedStudentsSidebar {...props} draggingStudent={dummyStudents[0]} />);

    const studentCard = screen.getByText('佐藤 健').closest('div[draggable="true"]')!;
    expect(studentCard.className).toContain('opacity-40');
    expect(studentCard.className).toContain('ring-2 ring-emerald-500');

    const otherCard = screen.getByText('鈴木 花子').closest('div[draggable="true"]')!;
    expect(otherCard.className).not.toContain('opacity-40');
  });

  it('8. 正常系: 一括割り当てボタンをクリックしたとき onAssignAll が呼ばれること', () => {
    render(<UnassignedStudentsSidebar {...props} />);

    const assignAllButton = screen.getByRole('button', { name: /空き区画へ一括割り当て/ });
    fireEvent.click(assignAllButton);

    expect(props.onAssignAll).toHaveBeenCalledTimes(1);
  });
});
