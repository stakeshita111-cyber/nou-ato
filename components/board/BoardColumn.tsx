"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task } from "@/types/task";
import TaskCard from "./TaskCard";

type BoardColumnProps = {
  id: string;
  title: string;
  tasks: Task[];
  onDelete: (id: string) => void;
  onEdit?: (task: Task) => void; // ★追加
};
export default function BoardColumn({ id, title, tasks, onDelete, onEdit }: BoardColumnProps) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="flex-1 min-w-[250px] bg-gray-50 p-4 rounded-xl border border-gray-200">
      <h2 className="font-bold text-gray-700 mb-4">{title}</h2>
      <SortableContext id={id} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[300px]">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onDelete={onDelete} onEdit={onEdit} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}