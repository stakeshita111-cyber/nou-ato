// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FarmOwnerSettingsModal, {
  FarmOwnerSettingsModalProps,
} from '@/components/teacher/farm-canvas/FarmOwnerSettingsModal';

describe('FarmOwnerSettingsModal Component', () => {
  const defaultProps: FarmOwnerSettingsModalProps = {
    isOpen: true,
    onClose: vi.fn(),
    farmName: 'テスト農園',
    onFarmNameChange: vi.fn(),
    ownerName: '農園 主太郎',
    onOwnerNameChange: vi.fn(),
    email: 'farmer@example.com',
    onEmailChange: vi.fn(),
    farmAddress: '神奈川県横浜市1-2-3',
    onFarmAddressChange: vi.fn(),
    onSave: vi.fn((e) => e.preventDefault()),
  };

  it('1. isOpen が false の場合は何も描画しないこと', () => {
    const { container } = render(<FarmOwnerSettingsModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('2. isOpen が true の場合、タイトルおよび各入力フィールドの値が表示されること', () => {
    render(<FarmOwnerSettingsModal {...defaultProps} />);

    expect(screen.getByText('農園・代表者設定')).toBeTruthy();
    expect(screen.getByDisplayValue('テスト農園')).toBeTruthy();
    expect(screen.getByDisplayValue('農園 主太郎')).toBeTruthy();
    expect(screen.getByDisplayValue('farmer@example.com')).toBeTruthy();
    expect(screen.getByDisplayValue('神奈川県横浜市1-2-3')).toBeTruthy();
  });

  it('3. 必須入力フィールド（農園名・代表者氏名）に required 属性が付与されていること', () => {
    render(<FarmOwnerSettingsModal {...defaultProps} />);

    const farmNameInput = screen.getByPlaceholderText('例: たなか農園') as HTMLInputElement;
    const ownerNameInput = screen.getByPlaceholderText('例: 山田 太郎') as HTMLInputElement;
    const emailInput = screen.getByPlaceholderText('例: teacher@example.com') as HTMLInputElement;

    expect(farmNameInput.required).toBe(true);
    expect(ownerNameInput.required).toBe(true);
    expect(emailInput.required).toBe(false);
  });

  it('4. 各入力の変更時に対応する onChange ハンドラーが呼ばれること', () => {
    const onFarmNameChange = vi.fn();
    const onOwnerNameChange = vi.fn();
    const onEmailChange = vi.fn();
    const onFarmAddressChange = vi.fn();

    render(
      <FarmOwnerSettingsModal
        {...defaultProps}
        onFarmNameChange={onFarmNameChange}
        onOwnerNameChange={onOwnerNameChange}
        onEmailChange={onEmailChange}
        onFarmAddressChange={onFarmAddressChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('例: たなか農園'), {
      target: { value: '新しい農園' },
    });
    expect(onFarmNameChange).toHaveBeenCalledWith('新しい農園');

    fireEvent.change(screen.getByPlaceholderText('例: 山田 太郎'), {
      target: { value: '新しい講師' },
    });
    expect(onOwnerNameChange).toHaveBeenCalledWith('新しい講師');

    fireEvent.change(screen.getByPlaceholderText('例: teacher@example.com'), {
      target: { value: 'new@example.com' },
    });
    expect(onEmailChange).toHaveBeenCalledWith('new@example.com');

    fireEvent.change(screen.getByPlaceholderText('例: 神奈川県横浜市青葉区...'), {
      target: { value: '千葉県成田市4-5-6' },
    });
    expect(onFarmAddressChange).toHaveBeenCalledWith('千葉県成田市4-5-6');
  });

  it('5. 閉じるボタン（✕）およびキャンセルボタンをクリックすると onClose が呼ばれること', () => {
    const onClose = vi.fn();
    render(<FarmOwnerSettingsModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('6. 背景 backdrop をクリックすると onClose が呼ばれるが、モーダル内部クリックでは伝播が止まり呼ばれないこと', () => {
    const onClose = vi.fn();
    const { container } = render(<FarmOwnerSettingsModal {...defaultProps} onClose={onClose} />);

    // モーダル内部のクリック
    const modalBox = screen.getByText('農園・代表者設定').closest('div[class*="rounded-3xl"]');
    expect(modalBox).not.toBeNull();
    if (modalBox) {
      fireEvent.click(modalBox);
      expect(onClose).not.toHaveBeenCalled();
    }

    // 外側の backdrop クリック
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('7. form の submit（保存するボタン押下）で onSave が呼ばれること', () => {
    const onSave = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(<FarmOwnerSettingsModal {...defaultProps} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: '保存する' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
