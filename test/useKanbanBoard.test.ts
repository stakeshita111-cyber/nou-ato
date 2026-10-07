import { describe, it, expect } from "vitest";

// タスク取得時に checklist JSON から badge_name, badge_icon を抽出展開するロジックの単体テスト
describe("Kanban board checklist badge mapping logic", () => {
  it("extracts badge_name and badge_icon from checklist JSON when top-level columns are undefined/null", () => {
    const rawDataFromDb = [
      {
        id: "task-1",
        title: "トマトの脇芽かき",
        status: "pool",
        category: "果菜",
        badge_name: null,
        badge_icon: null,
        checklist: {
          badge_name: "芽かきマスター",
          badge_icon: "✂️",
          phase: "育成・管理",
        },
      },
      {
        id: "task-2",
        title: "土作り",
        status: "todo",
        category: "土壌",
        badge_name: undefined,
        badge_icon: undefined,
        checklist: null,
      },
    ];

    const mappedTasks = rawDataFromDb.map((t: any) => {
      const cl = t.checklist && typeof t.checklist === "object" ? t.checklist : {};
      return {
        ...t,
        badge_name: t.badge_name || cl.badge_name || null,
        badge_icon: t.badge_icon || cl.badge_icon || null,
      };
    });

    expect(mappedTasks[0].badge_name).toBe("芽かきマスター");
    expect(mappedTasks[0].badge_icon).toBe("✂️");
    expect(mappedTasks[1].badge_name).toBeNull();
    expect(mappedTasks[1].badge_icon).toBeNull();
  });

  it("prepares update payload for Supabase without top-level badge columns, storing badge in checklist JSON", () => {
    const existingTask: { id: string; title: string; checklist: Record<string, any> } = {
      id: "task-100",
      title: "キュウリの収穫",
      checklist: {
        season: "夏",
      },
    };

    const updatedTaskInput = {
      id: "task-100",
      title: "キュウリの収穫",
      description: "大きくなった実をハサミでカット",
      badge_name: "収穫名人",
      badge_icon: "🥒",
    };

    const existingChecklist = existingTask.checklist && typeof existingTask.checklist === "object" ? existingTask.checklist : {};
    const updatedChecklist: Record<string, any> = {
      ...existingChecklist,
      badge_name: updatedTaskInput.badge_name || null,
      badge_icon: updatedTaskInput.badge_icon || null,
    };

    // DB update payload to tasks table
    const updatePayload = {
      title: updatedTaskInput.title,
      description: updatedTaskInput.description,
      checklist: updatedChecklist,
    };

    // Verify top-level badge_name or badge_icon are NOT in updatePayload
    expect("badge_name" in updatePayload).toBe(false);
    expect("badge_icon" in updatePayload).toBe(false);

    // Verify badge_name and badge_icon ARE stored inside checklist JSON
    expect(updatePayload.checklist.badge_name).toBe("収穫名人");
    expect(updatePayload.checklist.badge_icon).toBe("🥒");
    expect(updatePayload.checklist.season).toBe("夏");
  });
});
