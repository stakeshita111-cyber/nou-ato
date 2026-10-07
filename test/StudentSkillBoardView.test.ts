import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StudentSkillBoardView from "../components/student/StudentSkillBoardView";

describe("StudentSkillBoardView", () => {
  it("renders correctly with published task badges, slow spin animations, and pagination", () => {
    const mockTasks = [
      {
        id: "t1",
        status: "completed",
        title: "土作りタスク",
        badge_name: "土作り名人",
        badge_icon: "🚜",
      },
      {
        id: "t2",
        status: "not_started",
        title: "種まきタスク",
        badge_name: "種まきビギナー",
        badge_icon: "🌱",
      },
      {
        id: "t3",
        status: "not_started",
        title: "水やりタスク",
        tasks: {
          title: "水やりプロタスク",
          badge_name: "水やりマスター",
          badge_icon: "💧",
        },
      },
      {
        id: "t4",
        status: "not_started",
        title: "バッジなしタスク",
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(StudentSkillBoardView, { tasks: mockTasks, user: { name: "テスト生徒" } })
    );

    // バッジ連動およびaria-label/title設定の確認
    expect(html).toContain('aria-label="土作り名人"');
    expect(html).toContain('aria-label="種まきビギナー"');
    expect(html).toContain('aria-label="水やりマスター"');

    // バッジ記号（アイコン）の確認
    expect(html).toContain("🚜");
    expect(html).toContain("🌱");
    expect(html).toContain("💧");

    // バッジ総数 & 獲得数表示
    expect(html).toContain("1 / 3 獲得");

    // 獲得済みバッジのゆっくり回転アニメーションクラス
    expect(html).toContain("animate-spin-slow");

    // 未獲得バッジのグレーアウト状態
    expect(html).toContain("grayscale");

    // スライドアニメーションクラス
    expect(html).toContain("animate-slide-left");

    // 成長の足跡確認
    expect(html).toContain("土作りタスク");
  });

  it("extracts badges correctly when badge info is in nested tasks or direct properties", () => {
    const mockTasks = [
      {
        id: "t10",
        status: "completed",
        tasks: {
          title: "芽かき作業",
          badge_name: "芽かきマスター",
          badge_icon: "✂️",
        },
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(StudentSkillBoardView, { tasks: mockTasks, user: { name: "テスト生徒" } })
    );

    expect(html).toContain('aria-label="芽かきマスター"');
    expect(html).toContain("✂️");
    expect(html).toContain("animate-spin-slow");
  });

  it("handles empty tasks gracefully", () => {
    const html = renderToStaticMarkup(
      React.createElement(StudentSkillBoardView, { tasks: [], user: null })
    );

    expect(html).toContain("現在公開中のバッジはありません");
    expect(html).toContain("まだ達成したクエストはありません");
  });
});
