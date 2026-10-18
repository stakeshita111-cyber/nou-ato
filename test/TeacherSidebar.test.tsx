// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TeacherSidebar from '../components/teacher/TeacherSidebar';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('TeacherSidebar Component - Unread Journals Badge', () => {
  it('renders unread journals badge when unreadJournalsCount > 0', () => {
    const html = renderToStaticMarkup(
      React.createElement(TeacherSidebar, {
        activeMenu: 'dashboard',
        onMenuClick: vi.fn(),
        unreadJournalsCount: 5,
      })
    );

    expect(html).toContain('相談・日誌');
    expect(html).toContain('5');
    expect(html).toContain('bg-red-500');
  });

  it('hides unread journals badge when unreadJournalsCount is 0', () => {
    const html = renderToStaticMarkup(
      React.createElement(TeacherSidebar, {
        activeMenu: 'dashboard',
        onMenuClick: vi.fn(),
        unreadJournalsCount: 0,
      })
    );

    expect(html).toContain('相談・日誌');
    expect(html).not.toContain('bg-red-500 text-white text-[11px]');
  });

  it('hides unread journals badge when unreadJournalsCount is undefined', () => {
    const html = renderToStaticMarkup(
      React.createElement(TeacherSidebar, {
        activeMenu: 'dashboard',
        onMenuClick: vi.fn(),
      })
    );

    expect(html).toContain('相談・日誌');
    expect(html).not.toContain('bg-red-500 text-white text-[11px]');
  });
});
