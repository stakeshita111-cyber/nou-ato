import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WeatherWidget from '../components/ui/WeatherWidget';

describe('WeatherWidget', () => {
  it('renders with 24-hour detail graph expanded by default on mobile view', () => {
    const html = renderToStaticMarkup(React.createElement(WeatherWidget));

    // showMobileDetails = true defaults button label to "▲ 詳細グラフを閉じる"
    expect(html).toContain('▲ 詳細グラフを閉じる');

    // 横長配置のピンポイント気象サマリーおよび7大指標グリッドが正常にレンダリングされることを検証
    expect(html).toContain('ピンポイント気象');
    expect(html).toContain('農作業・生理判定 (7大指標)');
    expect(html).toContain('防除・散布');
  });
});
