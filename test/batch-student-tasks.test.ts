import { describe, it, expect } from "vitest";

describe("Batch student_tasks and base_task_id matching", () => {
  it("strictly matches tasks by base_task_id instead of fuzzy title matching", () => {
    const publicTasks = [
      { id: "task_1", title: "水やり" },
      { id: "task_2", title: "朝の水やり" },
    ];

    const studentTasks = [
      { id: "st_2", base_task_id: "task_2", title: "朝の水やり", status: "completed" },
    ];

    // Evaluate matching for task_1 ("水やり")
    const stMatchTask1 = studentTasks.find((st) => st.base_task_id === publicTasks[0].id);
    expect(stMatchTask1).toBeUndefined(); // Should NOT match "st_2"

    // Evaluate matching for task_2 ("朝の水やり")
    const stMatchTask2 = studentTasks.find((st) => st.base_task_id === publicTasks[1].id);
    expect(stMatchTask2).toBeDefined();
    expect(stMatchTask2?.status).toBe("completed");
  });

  it("filters out zombie student_tasks whose base_task_id no longer exists in published tasks", () => {
    const publicTasks = [
      { id: "task_1", title: "水やり" },
    ];

    const studentTasks = [
      { id: "st_1", base_task_id: "task_1", title: "水やり", status: "not_started" },
      { id: "st_deleted", base_task_id: "task_deleted_999", title: "削除されたタスク", status: "completed" },
    ];

    const validStudentTasks = studentTasks.filter((st) => {
      if (!st.base_task_id) return true;
      return publicTasks.some((pt) => pt.id === st.base_task_id);
    });

    expect(validStudentTasks).toHaveLength(1);
    expect(validStudentTasks[0].id).toBe("st_1");
  });
});
