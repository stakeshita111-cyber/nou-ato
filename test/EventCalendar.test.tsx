// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EventCalendar from '@/components/ui/EventCalendar';
import { EventItem } from '@/types/event';

describe('EventCalendar', () => {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
  const todayDateStr = `${todayYear}-${todayMonth}-${String(today.getDate()).padStart(2, '0')}`;

  const mockEvents: EventItem[] = [
    {
      id: 'event-1',
      date: todayDateStr,
      dateDisplay: todayDateStr,
      time: '10:00 - 12:00',
      title: '収穫感謝祭',
      location: '農園中央広場',
      fee: '無料',
      description: 'みんなで収穫をお祝いしましょう',
      category: 'harvest',
      reservedCount: 5,
      capacity: 20,
      attendees: [{ id: 'att-1', name: '山田太郎', plot: '区画A', status: 'confirmed' }],
    },
    {
      id: 'event-2',
      date: `${todayYear}-${todayMonth}-28`,
      dateDisplay: `${todayYear}-${todayMonth}-28`,
      time: '14:00 - 15:30',
      title: '土づくり講習会',
      location: 'レクチャールーム',
      fee: '500円',
      description: '堆肥の作り方を学びます',
      category: 'workshop',
      reservedCount: 10,
      capacity: 10,
      attendees: [],
    },
  ];

  it('renders monthly grid view with events chip', () => {
    render(<EventCalendar events={mockEvents} mode="teacher" />);

    expect(screen.getAllByText('収穫感謝祭').length).toBeGreaterThan(0);
  });

  it('displays selected date events when clicked', () => {
    render(<EventCalendar events={mockEvents} mode="teacher" />);

    // Selected date defaults to today
    expect(
      screen.getByText(
        (content) => content.includes('選択日:') && content.includes('のイベント (1件)')
      )
    ).toBeDefined();
  });

  it('switches between grid view and list view', () => {
    render(<EventCalendar events={mockEvents} mode="teacher" />);

    const listBtn = screen.getByText('📜 一覧');
    fireEvent.click(listBtn);

    expect(screen.getAllByText('土づくり講習会').length).toBeGreaterThan(0);

    const monthBtn = screen.getByText('📅 月表示');
    fireEvent.click(monthBtn);

    expect(screen.getAllByText('収穫感謝祭').length).toBeGreaterThan(0);
  });

  it('calls onReserveEvent when student clicks reserve button', () => {
    const handleReserve = vi.fn();
    render(
      <EventCalendar
        events={mockEvents}
        mode="student"
        studentName="花子"
        onReserveEvent={handleReserve}
      />
    );

    const reserveBtn = screen.getByText('🙋‍♂️ このイベントに参加予約する');
    fireEvent.click(reserveBtn);

    expect(handleReserve).toHaveBeenCalledWith('event-1');
  });
});
