import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type TaskType = "independent" | "academic_discussion";

interface TaskSelectorProps {
  value: TaskType;
  onChange: (value: TaskType) => void;
}

export function TaskSelector({ value, onChange }: TaskSelectorProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as TaskType)} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="independent">Independent Writing</TabsTrigger>
        <TabsTrigger value="academic_discussion">Academic Discussion</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export const TASK_PROMPTS: Record<TaskType, string> = {
  independent:
    "Do you agree or disagree with the following statement? It is better to work in a group than to work alone. Use specific reasons and examples to support your answer.",
  academic_discussion:
    "Your professor is teaching a class on environmental policy. Some students think individuals should take responsibility for reducing pollution. Others think governments and companies should lead. Which view do you agree with, and why?",
};
