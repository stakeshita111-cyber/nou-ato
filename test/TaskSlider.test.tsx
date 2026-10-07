import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TaskSlider from "../components/student/TaskSlider";

describe("TaskSlider Component", () => {
  const mockTasks = [
    {
      id: "task-1",
      title: "トマトの芽かき",
      description: "わき芽を摘み取りましょう。",
      target_crop: "トマト",
      status: "in_progress",
    },
    {
      id: "task-2",
      title: "ナスへの水やり",
      description: "根元にたっぷり水をあげましょう。",
      target_crop: "ナス",
      status: "in_progress",
    },
    {
      id: "task-3",
      title: "キュウリの収穫",
      description: "大きくなった実をハサミで切り取ります。",
      target_crop: "キュウリ",
      status: "completed",
    },
  ];

  it("renders active task slider correctly", () => {
    const handleSelect = vi.fn();
    const handleComplete = vi.fn();

    const html = renderToStaticMarkup(
      React.createElement(TaskSlider, {
        tasks: mockTasks,
        onSelect: handleSelect,
        onComplete: handleComplete,
      })
    );

    // Active tasks count display: "1 / 2" (since 2 tasks are active and 1 is completed)
    expect(html).toContain("1 / 2");
    expect(html).toContain("進行中のタスク (2)");
    expect(html).toContain("トマトの芽かき");
    expect(html).toContain("わき芽を摘み取りましょう。");
    expect(html).toContain("📖 詳細・手順を確認して作業する");
    expect(html).toContain("‹");
    expect(html).toContain("›");
  });

  it("renders empty state when tasks list is empty", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskSlider, {
        tasks: [],
        onSelect: vi.fn(),
        onComplete: vi.fn(),
      })
    );

    expect(html).toContain("取り組むタスクはありません");
    expect(html).toContain("講師が教材を公開すると、ここに表示されます。");
  });

  it("renders completed tasks when toggled", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskSlider, {
        tasks: [
          {
            id: "task-3",
            title: "キュウリの収穫",
            description: "収穫完了",
            target_crop: "キュウリ",
            status: "completed",
          },
        ],
        onSelect: vi.fn(),
        onComplete: vi.fn(),
      })
    );

    expect(html).toContain("すべてのタスクを完了しました！");
    expect(html).toContain("完了済みを表示 (1)");
  });
});
