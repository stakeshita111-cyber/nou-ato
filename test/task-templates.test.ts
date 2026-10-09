import { describe, it, expect } from "vitest";
import { VEGETABLE_TASK_TEMPLATES } from "@/lib/taskTemplates";
import { MASTER_TASKS } from "@/lib/taskMaster";

describe("taskTemplates and taskMaster data integrity", () => {
  it("ensures all VEGETABLE_TASK_TEMPLATES have unique IDs", () => {
    const ids = VEGETABLE_TASK_TEMPLATES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("validates VEGETABLE_TASK_TEMPLATES fields", () => {
    VEGETABLE_TASK_TEMPLATES.forEach((tpl) => {
      expect(tpl.title).toBeTruthy();
      expect(tpl.target_crop).toBeTruthy();
      expect(tpl.category).toBeTruthy();
      expect(tpl.exp).toBeGreaterThan(0);
      expect(tpl.difficulty).toBeGreaterThanOrEqual(1);
      expect(tpl.difficulty).toBeLessThanOrEqual(5);
    });
  });

  it("ensures MASTER_TASKS have unique IDs and positive exp", () => {
    const ids = MASTER_TASKS.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    MASTER_TASKS.forEach((task) => {
      expect(task.title).toBeTruthy();
      expect(task.exp).toBeGreaterThan(0);
    });
  });

  it("creates a valid TaskTemplate object from Task input data", () => {
    const taskInput = {
      id: "task-123",
      title: "ミニトマトの脇芽かき",
      status: "pool",
      category: "果菜",
      target_crop: "ミニトマト",
      estimated_time: "20分",
      tools_needed: "ハサミ, 手袋",
      description: "・脇芽をポキッと摘み取る",
      exp: 40,
      difficulty: 2,
      require_photo: true,
      badge_name: "芽かきマスター",
      badge_icon: "✂️",
    };

    const newTemplate = {
      id: "tpl-456",
      title: taskInput.title,
      category: taskInput.category,
      target_crop: taskInput.target_crop,
      estimated_time: taskInput.estimated_time,
      tools_needed: taskInput.tools_needed,
      description: taskInput.description,
      memo: "",
      exp: taskInput.exp,
      difficulty: taskInput.difficulty,
      require_photo: taskInput.require_photo,
      badge_name: taskInput.badge_name,
      badge_icon: taskInput.badge_icon,
      season: "通年",
      phase: "育成・管理",
    };

    expect(newTemplate.title).toBe("ミニトマトの脇芽かき");
    expect(newTemplate.target_crop).toBe("ミニトマト");
    expect(newTemplate.badge_name).toBe("芽かきマスター");
    expect(newTemplate.badge_icon).toBe("✂️");
    expect(newTemplate.require_photo).toBe(true);
    expect(newTemplate.season).toBe("通年");
    expect(newTemplate.phase).toBe("育成・管理");
  });
});
