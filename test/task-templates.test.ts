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
});
